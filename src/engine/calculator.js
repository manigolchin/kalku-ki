/**
 * CALCULATOR — Deterministic EFB 221 calculation engine
 *
 * NO AI. Pure math. Uses values from Regelwerk + Classifier + MaterialDecomposer.
 * Produces X, Y, Z, M, EP, GP with full traceability.
 */

import { FIRMA_DEFAULTS, GALABAU, FARBEN, BETONPREISE } from './regelwerk.js';
import { classifyPosition, isVorhaltePosition, isNUPosition } from './classifier.js';
import { scanLangtext, applyModifiers } from './langtextScanner.js';
import { decomposeMaterials, calculateMaterialX } from './materialDecomposer.js';
import { preisProTonneToM2, findSchuettdichte } from './unitConverter.js';

/**
 * Calculate a single position completely
 *
 * @param {Object} position - LV position { oz, short_text, long_text, quantity, unit }
 * @param {Array} allPositions - All positions in the LV (for Nebenmaterial checking)
 * @param {number} posIndex - Index of this position in allPositions
 * @param {Object} params - Firma parameters (override defaults)
 * @param {Object} priceOverrides - { hauptmaterial_preis, nu_preis } from Angebote
 * @returns {Object} Complete calculation result
 */
export function calculatePosition(position, allPositions = [], posIndex = 0, params = {}, priceOverrides) {
  priceOverrides = priceOverrides || {};
  const p = { ...FIRMA_DEFAULTS, ...params };
  const result = {
    // Input
    oz: position.oz,
    short_text: position.short_text,
    quantity: position.quantity || 0,
    unit: position.unit,

    // Classification
    classification: null,
    confidence: 0,

    // Langtext analysis
    modifiers: [],
    dimensions: {},

    // Values
    X: 0,           // Material EUR/unit
    Y: 0,           // Minutes/unit
    Z: 0,           // Equipment EUR/h
    M: 0,           // NU EUR/unit
    AA: null,        // Override EUR/unit (for Vorhalten)

    // Calculated
    EP_lohn: 0,
    EP_material: 0,
    EP_geraet: 0,
    EP_nu: 0,
    EP: 0,
    GP: 0,

    // Meta
    farbe: FARBEN.annahme, // default yellow until Angebot confirms
    modus: 'normal',       // normal | vorhalten | nu | unknown
    quellen: [],           // source trail
    kommentare: [],        // cell comments
    warnings: [],          // validation warnings
    materialDecomposition: null,
  };

  // Skip headers
  if (position.is_header) {
    result.modus = 'header';
    return result;
  }

  // ─── STEP 1: Classify ─────────────────────────────────────────
  const classification = classifyPosition(
    position.short_text,
    position.long_text,
    position.unit
  );
  result.classification = classification;
  result.confidence = classification.confidence;

  // ─── STEP 2: Check special modes ──────────────────────────────

  // Vorhalten mode
  if (isVorhaltePosition(position.unit) || classification.modus === 'vorhalten') {
    return calculateVorhalten(position, classification, result);
  }

  // NU mode
  if (classification.modus === 'nu' || isNUPosition(position.short_text, position.long_text)) {
    return calculateNU(position, result, p, priceOverrides);
  }

  // Zulage mode — only the price DIFFERENCE
  if (classification.modus === 'zulage') {
    return calculateZulage(position, classification, result, p, priceOverrides, allPositions);
  }

  // Unknown
  if (classification.modus === 'unknown' || !classification.category) {
    result.modus = 'unknown';
    result.warnings.push('Position nicht automatisch klassifizierbar — manuell prüfen');
    result.farbe = FARBEN.achtung;
    return result;
  }

  // ─── STEP 3: Scan Langtext ────────────────────────────────────
  const scan = scanLangtext(position.long_text, position.short_text);
  result.modifiers = scan.modifiers.map(m => m.beschreibung);
  result.dimensions = scan.dimensions;

  // ─── STEP 4: Look up base values from Regelwerk ───────────────
  const category = GALABAU[classification.category];
  let leistungKey = classification.leistung;

  // Handle bordstein upgrade from Langtext
  const fundModifier = scan.modifiers.find(m => m.id === 'inkl_fundament_und_rueckenstuetze');
  if (fundModifier && leistungKey === 'bordstein_setzen') {
    leistungKey = 'bordstein_fundament_rueckenstuetze';
  }

  const leistung = category?.leistungen?.[leistungKey];

  if (!leistung) {
    result.warnings.push(`Leistung "${leistungKey}" nicht im Regelwerk gefunden`);
    result.farbe = FARBEN.achtung;
    result.modus = 'unknown';
    return result;
  }

  // Base values
  let Y = leistung.Y || 0;
  let Z = leistung.Z || p.geraete_default;

  // Handle variable Y (e.g. Handarbeit min-max)
  if (leistung.Y_min && leistung.Y_max) {
    Y = leistung.Y_min; // conservative default
  }

  // Handle per-unit Y for time-based positions
  if (leistung.Y_per_tag) {
    const unitLower = (position.unit || '').toLowerCase();
    if (unitLower === 'stwo' || unitLower === 'stWo') Y = leistung.umrechnung?.StWo || leistung.Y_per_tag * 5;
    else if (unitLower === 'stmt') Y = leistung.umrechnung?.StMt || leistung.Y_per_tag * 20;
    else Y = leistung.Y_per_tag;
  }

  // ─── STEP 5: Apply Langtext modifiers ─────────────────────────
  const { values: adjustedValues, comments: modComments } = applyModifiers(
    { Y, Z, X: 0 },
    scan.modifiers
  );
  Y = adjustedValues.Y;
  Z = adjustedValues.Z;
  result.kommentare.push(...modComments);

  // Handle Schüttgut threshold (Großfläche vs. Kleinmenge)
  if (classification.category === 'schuettgueter') {
    const area = position.quantity || 0;
    if (area < 200) {
      const kleinLeistung = category.leistungen?.einbau_kleinmenge;
      if (kleinLeistung) {
        Y = position.unit?.toLowerCase() === 'm²'
          ? (category.leistungen?.einbau_kleinmenge_m2?.Y || 3)
          : kleinLeistung.Y;
        Z = kleinLeistung.Z;
        result.kommentare.push(`Kleinmenge (<200m²): Y=${Y}, Z=${Z}`);
      }
    }
  }

  // ─── Verdichtungsschichten auto-adjustment (§2, §3) ──────────
  if (leistung.modifier_verdichtung) {
    const schichtdicke = leistung.modifier_verdichtung.standard_schichtdicke_cm || 33.33;
    const zusatz = leistung.modifier_verdichtung.zusatz_min_per_schicht || 1;
    const fillHeight_cm = scan.dimensions?.dicke_cm || scan.dimensions?.hoehe_cm || scan.dimensions?.schichtdicke_cm;
    if (fillHeight_cm && typeof fillHeight_cm === 'number' && schichtdicke > 0 && fillHeight_cm > schichtdicke) {
      const schichten = Math.ceil(fillHeight_cm / schichtdicke);
      const zusatzY = (schichten - 1) * zusatz; // first layer is in base Y
      Y += zusatzY;
      result.kommentare.push(`Verdichtung: ${schichten} Schichten à ${schichtdicke}cm → +${zusatzY} min/m³`);
    }
  }

  // ─── Oberboden thickness adjustment (§2.1) ────────────────────
  if (leistungKey === 'oberboden_abtragen' && leistung.modifier_flaechig) {
    const dicke_cm = scan.dimensions?.dicke_cm || scan.dimensions?.schichtdicke_cm;
    if (dicke_cm && typeof dicke_cm === 'number' && position.unit?.toLowerCase() === 'm²') {
      const zusatz_per_10cm = leistung.modifier_flaechig.zusatz_min_m2_per_10cm || 0.5;
      const zusatzY = (dicke_cm / 10) * zusatz_per_10cm;
      Y += zusatzY; // ADD to base Y, not replace
      result.kommentare.push(`Oberboden flächig ${dicke_cm}cm → +${zusatzY} min/m²`);
    }
  }

  // ─── STEP 6: Material Decomposition ───────────────────────────
  const decomposition = decomposeMaterials(leistungKey, scan.dimensions, allPositions, posIndex);
  result.materialDecomposition = decomposition;

  // Calculate X — with Schüttgut unit conversion if needed
  let hauptPreis = priceOverrides.hauptmaterial_preis || decomposition.hauptmaterial?.fallback_preis || 0;

  // Schüttgut: if priceOverrides has einheit_angebot in €/t and LV is m², auto-convert
  if (hauptPreis > 0 && decomposition.hauptmaterial?.conversion === 't_to_unit') {
    const lvUnit = (position.unit || '').toLowerCase().replace(/²/g, '2').replace(/³/g, '3');
    const angUnit = (priceOverrides.einheit_angebot || '').toLowerCase().replace(/²/g, '2').replace(/³/g, '3');
    if (angUnit === 't' && lvUnit === 'm2') {
      const dicke = scan.dimensions?.schichtdicke_cm || scan.dimensions?.dicke_cm;
      if (dicke) {
        const conv = preisProTonneToM2(hauptPreis, position.short_text, dicke);
        if (conv.preis_m2 > 0) {
          result.kommentare.push(`Schüttgut-Umrechnung: ${conv.formel}`);
          hauptPreis = conv.preis_m2;
        }
      }
    } else if (angUnit === 't' && lvUnit === 'm3') {
      const dichte = findSchuettdichte(position.short_text);
      if (dichte) {
        hauptPreis = round2(hauptPreis / dichte.lose);
        result.kommentare.push(`€/t ÷ ${dichte.lose} t/m³ = ${hauptPreis} €/m³`);
      }
    }
  }

  const { X_total, formel_parts } = calculateMaterialX(decomposition, hauptPreis);

  let X = decomposition.X_rein_arbeit ? 0 : X_total;

  // Add Nebenmaterial from Langtext modifiers (e.g. Rückenbeton)
  if (adjustedValues.nebenmaterial_beton_lfm && !decomposition.X_rein_arbeit) {
    // Only add if not already in decomposition
    const alreadyInDecomp = decomposition.nebenmaterial.some(n =>
      n.id === 'rueckenbeton_einseitig' || n.id === 'fundament_und_rueckenstuetze'
    );
    if (!alreadyInDecomp) {
      X += adjustedValues.nebenmaterial_beton_lfm;
      formel_parts.push(`Langtext-Beton: ${adjustedValues.nebenmaterial_beton_lfm.toFixed(2)} €/lfm`);
    }
  }

  // Set Beton price for concrete positions
  if (decomposition.hauptmaterial?.preisquelle === 'beton_menge') {
    const totalM3 = (position.quantity || 0);
    X = totalM3 < BETONPREISE.schwelle_m3
      ? decomposition.hauptmaterial.preis_klein
      : decomposition.hauptmaterial.preis_lkw;
    result.kommentare.push(
      totalM3 < 3
        ? `Beton Kleinmenge: ${X} €/m³`
        : `Beton LKW inkl. Pumpe: ${X} €/m³`
    );
  }

  // Schneidarbeiten: X always empty
  if (leistungKey.startsWith('schneiden_')) {
    X = 0;
    result.kommentare.push('Schneidarbeiten: X immer leer');
  }

  // Price source color
  if (priceOverrides.hauptmaterial_preis > 0) {
    result.farbe = FARBEN.angebot;
    result.quellen.push(priceOverrides.quelle || 'Angebot');
  } else if (hauptPreis > 0) {
    result.farbe = FARBEN.annahme;
    result.quellen.push('Erfahrungspreis/Regelwerk');
  } else if (X === 0 && decomposition.X_rein_arbeit) {
    result.farbe = FARBEN.annahme; // Pure labor, no material needed
    result.quellen.push('Regelwerk (reine Arbeit)');
  } else {
    result.farbe = FARBEN.achtung;
    result.quellen.push('Kein Preis gefunden — manuell prüfen');
  }

  // ─── STEP 7: Calculate EP ─────────────────────────────────────
  result.X = round2(X);
  result.Y = round2(Y);
  result.Z = round2(Z);
  result.M = 0;
  result.modus = 'normal';

  // Lohn = (Y min / 60) × Stundensatz
  result.EP_lohn = round2((Y / 60) * p.stundensatz);

  // Material = X × (1 + Zuschlag)
  result.EP_material = round2(X * (1 + p.zuschlag_material));

  // Gerät = (Y min / 60) × Z EUR/h
  result.EP_geraet = round2((Y / 60) * Z);

  // NU = 0 for normal positions
  result.EP_nu = 0;

  // EP = sum
  result.EP = round2(result.EP_lohn + result.EP_material + result.EP_geraet + result.EP_nu);

  // GP = EP × Menge
  result.GP = round2(result.EP * result.quantity);

  // ─── STEP 8: Add source comments ─────────────────────────────
  result.kommentare.push(
    `Regel: ${classification.category}.${leistungKey}`,
    `Y=${Y} min (${leistung.hinweis || 'Leitfaden'})`,
    ...formel_parts,
    ...decomposition.hinweise
  );

  return result;
}


// ─── VORHALTEN CALCULATION ────────────────────────────────────────
function calculateVorhalten(position, classification, result) {
  result.modus = 'vorhalten';
  result.X = 0;
  result.Y = 0;
  result.M = 0;
  result.farbe = FARBEN.aa_override;

  // Find the matching Vorhalten rule
  const category = GALABAU[classification.category];
  const leistung = category?.leistungen?.[classification.leistung];

  if (leistung?.AA_override) {
    result.AA = leistung.AA_override;
    result.EP = leistung.AA_override;
    result.kommentare.push(
      `Vorhalten: AA=${leistung.AA_override} €/${position.unit}`,
      'X=leer, Y=0 (Vorhalte-Position)'
    );
  } else {
    result.AA = 0;
    result.warnings.push('Vorhalte-Position ohne AA-Wert — manuell setzen');
    result.farbe = FARBEN.achtung;
  }

  result.GP = round2(result.EP * result.quantity);
  result.quellen.push('Regelwerk (Vorhalten)');
  return result;
}


// ─── NU CALCULATION ───────────────────────────────────────────────
function calculateNU(position, result, params, priceOverrides) {
  priceOverrides = priceOverrides || {};
  result.modus = 'nu';
  result.X = 0;
  result.Y = 0;
  result.Z = 0;

  if (priceOverrides.nu_preis > 0) {
    result.M = priceOverrides.nu_preis;
    result.EP_nu = round2(priceOverrides.nu_preis * (1 + params.zuschlag_nu));
    result.EP = result.EP_nu;
    result.farbe = FARBEN.angebot;
    result.quellen.push(priceOverrides.quelle || 'NU-Angebot');
  } else {
    result.M = 0;
    result.warnings.push('NU-Position ohne Preis — NU-Angebot einholen');
    result.farbe = FARBEN.achtung;
  }

  result.GP = round2(result.EP * result.quantity);
  result.kommentare.push('NU-Position: X=leer, Y=0, Preis in M');
  return result;
}


// ─── CALCULATE ENTIRE PROJECT ─────────────────────────────────────

/**
 * Auto-calculate all positions in a project
 * @param {Array} positions - All LV positions
 * @param {Object} params - Firma parameters
 * @param {Object} priceMap - Map of position OZ → { hauptmaterial_preis, nu_preis, quelle }
 * @returns {{ positions: Array, summary: Object, warnings: Array }}
 */
export function calculateProject(positions, params = {}, priceMap = {}) {
  const results = [];
  const warnings = [];
  let totalGP = 0;
  let totalLohn = 0;
  let totalMaterial = 0;
  let totalGeraet = 0;
  let totalNU = 0;
  let classified = 0;
  let unclassified = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (pos.is_header) {
      results.push({ ...pos, modus: 'header' });
      continue;
    }

    const priceOverride = (priceMap && priceMap[pos.oz]) || {};
    const calcResult = calculatePosition(pos, positions, i, params, priceOverride);

    results.push({
      ...pos,
      ...calcResult,
      // Map to existing field names for compatibility
      material_cost: calcResult.X,
      time_minutes: calcResult.Y,
      nu_cost: calcResult.M,
    });

    if (calcResult.classification?.confidence > 0.5) {
      classified++;
    } else {
      unclassified++;
    }

    totalGP += calcResult.GP || 0;
    totalLohn += (calcResult.EP_lohn || 0) * (calcResult.quantity || 0);
    totalMaterial += (calcResult.EP_material || 0) * (calcResult.quantity || 0);
    totalGeraet += (calcResult.EP_geraet || 0) * (calcResult.quantity || 0);
    totalNU += (calcResult.EP_nu || 0) * (calcResult.quantity || 0);

    if (calcResult.warnings?.length > 0) {
      warnings.push(...calcResult.warnings.map(w => ({ oz: pos.oz, text: pos.short_text, warning: w })));
    }
  }

  return {
    positions: results,
    summary: {
      totalGP: round2(totalGP),
      totalLohn: round2(totalLohn),
      totalMaterial: round2(totalMaterial),
      totalGeraet: round2(totalGeraet),
      totalNU: round2(totalNU),
      anteil_lohn: totalGP > 0 ? round2(totalLohn / totalGP * 100) : 0,
      anteil_material: totalGP > 0 ? round2(totalMaterial / totalGP * 100) : 0,
      anteil_geraet: totalGP > 0 ? round2(totalGeraet / totalGP * 100) : 0,
      anteil_nu: totalGP > 0 ? round2(totalNU / totalGP * 100) : 0,
      classified,
      unclassified,
      totalPositions: classified + unclassified,
    },
    warnings,
  };
}


// ─── ZULAGE CALCULATION ──────────────────────────────────────────
function calculateZulage(position, classification, result, params, priceOverrides, allPositions) {
  priceOverrides = priceOverrides || {};
  result.modus = 'zulage';
  result.Y = 0; // Zulage usually has no extra time (pure material swap)
  result.Z = 0;

  // Find the base position this Zulage refers to
  const baseRef = classification.zulage_basis_oz;
  let basePos = null;
  if (baseRef && allPositions) {
    basePos = allPositions.find(p => p.oz === baseRef);
  }

  // Material difference
  if (priceOverrides.hauptmaterial_preis > 0) {
    // Zulage price IS the difference — use directly
    result.X = priceOverrides.hauptmaterial_preis;
    result.EP_material = round2(result.X * (1 + params.zuschlag_material));
    result.farbe = FARBEN.angebot;
    result.quellen.push(priceOverrides.quelle || 'Angebot (Zulage)');
    result.kommentare.push('Zulage: NUR Differenzkosten (nicht Gesamtpreis)');
  } else {
    result.X = 0;
    result.farbe = FARBEN.achtung;
    result.warnings.push('Zulage ohne Preisdifferenz — manuell prüfen');
  }

  // NU difference
  if (priceOverrides.nu_preis > 0) {
    result.M = priceOverrides.nu_preis;
    result.EP_nu = round2(result.M * (1 + params.zuschlag_nu));
  }

  result.EP = round2(result.EP_material + result.EP_nu);
  result.GP = round2(result.EP * result.quantity);
  result.kommentare.push(
    basePos ? `Zulage zu Pos. ${basePos.oz}` : 'Zulage (Bezugsposition nicht identifiziert)'
  );

  return result;
}


function round2(val) {
  return Math.round(val * 100) / 100;
}
