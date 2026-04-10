/**
 * UNIT CONVERTER — All construction unit conversions
 *
 * Deterministic code, no AI. Uses Schüttdichten from regelwerk.
 * Handles: t↔m³, m³↔m², €/t→€/m², Auflockerung, etc.
 */

import { SCHUETTDICHTEN, AUFLOCKERUNG } from './regelwerk.js';

// ─── FIND BEST MATCHING SCHÜTTDICHTE ──────────────────────────────
/**
 * Find the matching Schüttdichte for a material described in text
 * @param {string} text - Material description from LV or Angebot
 * @returns {Object|null} { lose, verdichtung, verschnitt, label }
 */
export function findSchuettdichte(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  // Exact matches first
  if (t.includes('sts') || t.includes('schottertragschicht')) return SCHUETTDICHTEN.sts_0_32;
  if (t.includes('frostschutz') || t.includes('fsts')) return SCHUETTDICHTEN.frostschutz_0_56;
  if (t.includes('asphalt') && (t.includes('mischgut') || t.includes('einbau'))) return SCHUETTDICHTEN.asphaltmischgut;
  if (t.includes('asphalt')) return SCHUETTDICHTEN.asphalt;
  if (t.includes('beton')) return SCHUETTDICHTEN.beton;
  if (t.includes('mutterboden') || t.includes('oberboden')) return SCHUETTDICHTEN.mutterboden;
  if (t.includes('brechsand') || t.includes('splitt')) return SCHUETTDICHTEN.brechsand_2_5;
  if (t.includes('bettmaterial') || t.includes('pflasterbett')) return SCHUETTDICHTEN.bettmaterial_0_5;
  if (t.includes('fugenmaterial')) return SCHUETTDICHTEN.fugenmaterial_0_2;
  if (t.includes('rheinsand')) return SCHUETTDICHTEN.rheinsand_0_2;
  if (t.includes('fallschutz') && t.includes('sand')) return SCHUETTDICHTEN.fallschutzsand;
  if (t.includes('rc') && (t.includes('schotter') || t.includes('material'))) return SCHUETTDICHTEN.rc_schotter;
  if (t.includes('schotter') || t.includes('kies')) return SCHUETTDICHTEN.sts_0_32;
  if (t.includes('sand')) return SCHUETTDICHTEN.sand;
  if (t.includes('erde') || t.includes('erdaushub')) return SCHUETTDICHTEN.erdaushub;

  return null;
}


// ─── PRICE CONVERSIONS ────────────────────────────────────────────

/**
 * Convert €/t to €/m³
 * @param {number} preis_t - Price per tonne
 * @param {number} dichte - Schüttdichte t/m³
 * @returns {number} Price per m³
 */
export function preisProTonneToM3(preis_t, dichte) {
  if (!dichte || dichte === 0) return 0;
  return preis_t / dichte;
}

/**
 * Convert €/m³ to €/m² using layer thickness
 * @param {number} preis_m3 - Price per m³
 * @param {number} dicke_cm - Layer thickness in cm
 * @param {number} verdichtung - Compaction factor (default 1.0)
 * @param {number} verschnitt - Waste factor (default 0.0 = 0%)
 * @returns {number} Price per m²
 */
export function preisM3ToM2(preis_m3, dicke_cm, verdichtung = 1.0, verschnitt = 0.0) {
  const dicke_m = dicke_cm / 100;
  return preis_m3 * dicke_m * verdichtung * (1 + verschnitt);
}

/**
 * Full conversion: €/t → €/m² (most common conversion)
 * @param {number} preis_t - Price per tonne
 * @param {string} materialText - Material description for density lookup
 * @param {number} dicke_cm - Layer thickness in cm
 * @returns {{ preis_m2, preis_m3, dichte, verdichtung, verschnitt, formel }}
 */
export function preisProTonneToM2(preis_t, materialText, dicke_cm) {
  const material = findSchuettdichte(materialText);
  if (!material) {
    return { preis_m2: 0, error: `Keine Schüttdichte für "${materialText}" gefunden` };
  }

  const preis_m3 = preis_t / material.lose;
  const preis_m2 = preis_m3 * (dicke_cm / 100) * material.verdichtung * (1 + material.verschnitt);

  return {
    preis_m2: round2(preis_m2),
    preis_m3: round2(preis_m3),
    dichte: material.lose,
    verdichtung: material.verdichtung,
    verschnitt: material.verschnitt,
    formel: `${preis_t} €/t ÷ ${material.lose} = ${round2(preis_m3)} €/m³ × ${dicke_cm/100}m × ${material.verdichtung} × ${1+material.verschnitt} = ${round2(preis_m2)} €/m²`,
  };
}


// ─── VOLUME / MASS CONVERSIONS ────────────────────────────────────

/**
 * Convert tonnes to m³
 */
export function tonnenToM3(tonnen, dichte) {
  if (!dichte || dichte === 0) return 0;
  return tonnen / dichte;
}

/**
 * Convert m³ to tonnes
 */
export function m3ToTonnen(m3, dichte) {
  return m3 * dichte;
}

/**
 * Convert m³ to m² using layer thickness
 */
export function m3ToM2(m3, dicke_cm) {
  if (!dicke_cm || dicke_cm === 0) return 0;
  return m3 / (dicke_cm / 100);
}

/**
 * Convert m² to m³ using layer thickness
 */
export function m2ToM3(m2, dicke_cm) {
  return m2 * (dicke_cm / 100);
}


// ─── AUFLOCKERUNG (DIN 18300) ─────────────────────────────────────

/**
 * Calculate loosened volume from in-situ volume
 * @param {number} volumen_gewachsen - In-situ volume m³
 * @param {number} bk_von - Bodenklasse from
 * @param {number} bk_bis - Bodenklasse to (optional)
 * @returns {{ volumen_lose, faktor, klasse }}
 */
export function auflockerung(volumen_gewachsen, bk_von, bk_bis = null) {
  const bk = bk_bis || bk_von;
  let key;
  if (bk <= 2) key = 'bk_1_2';
  else if (bk <= 3) key = 'bk_3';
  else if (bk <= 5) key = 'bk_4_5';
  else key = 'bk_6_7';

  const af = AUFLOCKERUNG[key];
  return {
    volumen_lose: round2(volumen_gewachsen * af.faktor),
    faktor: af.faktor,
    klasse: af.label,
  };
}


// ─── UNIT MATCHING ────────────────────────────────────────────────

/**
 * Determine if and how to convert between Angebot unit and LV unit
 * @param {string} angebotUnit - Unit from supplier quote (€/t, €/m³, etc.)
 * @param {string} lvUnit - Unit from LV position (m², m³, lfm, St, etc.)
 * @param {Object} dimensions - Extracted dimensions from Langtext
 * @param {string} materialText - Material description
 * @returns {{ conversionNeeded, convert(price) → price, formel }}
 */
export function getUnitConversion(angebotUnit, lvUnit, dimensions, materialText) {
  const au = normalizeUnit(angebotUnit);
  const lu = normalizeUnit(lvUnit);

  // Same unit — no conversion
  if (au === lu) {
    return { conversionNeeded: false, convert: (p) => p, formel: 'Gleiche Einheit' };
  }

  const material = findSchuettdichte(materialText);

  // t → m³
  if (au === 't' && lu === 'm3') {
    if (!material) return { error: 'Schüttdichte unbekannt' };
    return {
      conversionNeeded: true,
      convert: (p) => round2(p / material.lose),
      formel: `÷ ${material.lose} t/m³`,
    };
  }

  // t → m²
  if (au === 't' && lu === 'm2') {
    if (!material) return { error: 'Schüttdichte unbekannt' };
    const dicke = dimensions?.schichtdicke_cm || dimensions?.dicke_cm;
    if (!dicke) return { error: 'Schichtdicke unbekannt (nicht im Langtext gefunden)' };
    return {
      conversionNeeded: true,
      convert: (p) => round2(
        (p / material.lose) * (dicke / 100) * material.verdichtung * (1 + material.verschnitt)
      ),
      formel: `÷ ${material.lose} × ${dicke}cm × ${material.verdichtung} × ${1+material.verschnitt}`,
    };
  }

  // m³ → m²
  if (au === 'm3' && lu === 'm2') {
    const dicke = dimensions?.schichtdicke_cm || dimensions?.dicke_cm;
    if (!dicke) return { error: 'Schichtdicke unbekannt' };
    const vd = material?.verdichtung || 1.0;
    const vs = material?.verschnitt || 0;
    return {
      conversionNeeded: true,
      convert: (p) => round2(p * (dicke / 100) * vd * (1 + vs)),
      formel: `× ${dicke}cm × ${vd} × ${1+vs}`,
    };
  }

  // m² → m³
  if (au === 'm2' && lu === 'm3') {
    const dicke = dimensions?.schichtdicke_cm || dimensions?.dicke_cm;
    if (!dicke) return { error: 'Schichtdicke unbekannt' };
    return {
      conversionNeeded: true,
      convert: (p) => round2(p / (dicke / 100)),
      formel: `÷ ${dicke}cm`,
    };
  }

  // St → lfm (e.g. Bordstein: 1m Elemente)
  if (au === 'st' && lu === 'lfm') {
    const elemLen = dimensions?.elementlaenge_m || 1.0;
    return {
      conversionNeeded: true,
      convert: (p) => round2(p / elemLen),
      formel: `÷ ${elemLen}m (Elementlänge)`,
    };
  }

  // lfm → m² (e.g. cutting: min/m² × thickness = min/lfm)
  if (au === 'lfm' && lu === 'm2') {
    const dicke = dimensions?.dicke_cm || dimensions?.pflaster_dicke_cm;
    if (!dicke) return { error: 'Dicke unbekannt' };
    return {
      conversionNeeded: true,
      convert: (p) => round2(p / (dicke / 100)),
      formel: `÷ ${dicke}cm`,
    };
  }

  return { error: `Konvertierung ${angebotUnit} → ${lvUnit} nicht implementiert` };
}


// ─── HELPERS ──────────────────────────────────────────────────────

function normalizeUnit(unit) {
  if (!unit) return '';
  let u = unit.toLowerCase().trim()
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/stk/g, 'st').replace(/stck/g, 'st').replace(/stück/g, 'st')
    .replace(/lfdm/g, 'm').replace(/lfd\.?\s*m/g, 'm').replace(/lfm/g, 'm')
    .replace(/psch/g, 'psch').replace(/pau/g, 'psch')
    .replace(/^€\//, ''); // strip €/ prefix
  // "lm" = "m"
  if (u === 'lm') u = 'm';
  return u;
}

function round2(val) {
  return Math.round(val * 100) / 100;
}

export { round2, normalizeUnit };
