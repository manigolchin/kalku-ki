/**
 * AUTO-CALC ORCHESTRATOR — Main entry point for automatic calculation
 *
 * This is the "one button" function:
 * 1. Takes GAEB-imported positions
 * 2. Classifies each position
 * 3. Scans Langtext for modifiers
 * 4. Decomposes materials (Haupt + Neben)
 * 5. Resolves prices (waterfall)
 * 6. Calculates EP/GP deterministically
 * 7. Runs plausibility checks
 * 8. Returns fully calculated positions with color codes + comments
 */

import { calculateProject } from './calculator.js';
import { checkProject } from './plausiChecker.js';
// SIRADOS DEAKTIVIERT (CLAUDE.md v1.3, Zeile 71-82: "bis auf Widerruf durch den Master")
// import { findBestSiradosMatch, isSiradosLoaded } from './siradosSearch.js';
import { FIRMA_DEFAULTS, FARBEN } from './regelwerk.js';
import { hasApiKey } from './angebotExtractor.js';
import { classifyWithAI, analyzeLangtextWithAI, findPriceWithAI } from './aiAssistant.js';
import { log, logWarn } from './logger.js';

/**
 * Run auto-calculation on all positions
 *
 * @param {Array} positions - Raw positions from GAEB import
 *   Each: { oz, short_text, long_text, quantity, unit, is_header }
 * @param {Object} options - Configuration
 *   { params, priceMap, useSirados, onProgress }
 * @returns {Object} { positions, summary, plausi, stats }
 */
export async function autoCalculate(positions, options = {}) {
  const {
    params = {},
    priceMap = {},       // oz → { hauptmaterial_preis, nu_preis, quelle }
    useSirados = false,  // DEAKTIVIERT — Boss-Anweisung CLAUDE.md v1.3
    onProgress = null,   // callback(step, current, total)
  } = options;

  const mergedParams = { ...FIRMA_DEFAULTS, ...params };
  const startTime = Date.now();

  log('autoCalc', '═══ AUTO-KALKULATION GESTARTET ═══', {
    positionen: positions.length,
    angebotPreise: Object.keys(priceMap).length,
    sirados: 'DEAKTIVIERT (CLAUDE.md v1.3)',
    apiKeyVorhanden: hasApiKey(),
  });

  // Clean null entries from priceMap + log details
  const safePriceMap = {};
  for (const [oz, pm] of Object.entries(priceMap || {})) {
    if (!pm || typeof pm !== 'object') continue;
    safePriceMap[oz] = pm;
    if (pm.hauptmaterial_preis > 0 || pm.nu_preis > 0) {
      log('autoCalc', `  PriceMap ${oz}: X=${pm.hauptmaterial_preis || 0}, M=${pm.nu_preis || 0}`, { quelle: pm.quelle });
    }
  }

  // ─── Phase 1: Calculate all positions ────────────────────────
  if (onProgress) onProgress('classify', 0, positions.length);

  const calcResult = calculateProject(positions, mergedParams, safePriceMap);

  log('autoCalc', 'Phase 1 — Kalkulation abgeschlossen', {
    classified: calcResult.summary.classified,
    unclassified: calcResult.summary.unclassified,
    totalGP: calcResult.summary.totalGP,
  });

  // Log each position result
  for (const pos of calcResult.positions) {
    if (pos.modus === 'header') continue;
    const classInfo = pos.classification ? `${pos.classification.category}.${pos.classification.leistung}` : 'unknown';
    log('autoCalc', `  ${pos.oz} | ${pos.modus} | ${classInfo} | X=${pos.X} Y=${pos.Y} Z=${pos.Z} M=${pos.M} EP=${pos.EP} GP=${pos.GP}`, {
      short_text: (pos.short_text || '').slice(0, 60),
      confidence: pos.confidence,
      farbe: pos.farbe,
    });
    if (pos.warnings?.length > 0) {
      logWarn('autoCalc', `  ⚠ ${pos.oz}: ${pos.warnings.join('; ')}`);
    }
  }

  if (onProgress) onProgress('calculate', positions.length, positions.length);

  // ─── Phase 2: SIRADOS DEAKTIVIERT ───────────────────────────
  // Preisquellen-Policy v1.1 (CLAUDE.md): Sirados ist bis auf Widerruf
  // durch den Master NICHT zu verwenden. Waterfall:
  //   1. Projekt-Angebote (grün)
  //   2. Preisdatenbank preise.xlsx (gelb)
  //   3. knowledge_base.json erfahrungspreise (gelb)
  //   4. Internet-Recherche (rot) — nur Notnagel
  log('autoCalc', 'Phase 2 — Sirados: DEAKTIVIERT (CLAUDE.md v1.3 Preisquellen-Policy)');
  calcResult.siradosHits = 0;

  if (onProgress) onProgress('sirados', positions.length, positions.length);

  // ─── Phase 2.5: AI assistance for unknown/unpriced positions ──
  let aiStats = { classified: 0, priced: 0, langtextAnalyzed: 0 };
  const useAI = options.useAI !== false && hasApiKey();
  log('autoCalc', `Phase 2.5 — KI: ${useAI ? 'aktiv' : 'deaktiviert (kein API Key)'}`);

  if (useAI) {
    if (onProgress) onProgress('ai_analyse', 0, positions.length);

    // Find positions that need AI help
    const unknownPositions = calcResult.positions.filter(p =>
      p.modus === 'unknown' && !p.is_header
    );
    const unpricedPositions = calcResult.positions.filter(p =>
      p.modus === 'normal' && p.X === 0 &&
      !p.materialDecomposition?.X_rein_arbeit && !p.is_header &&
      !safePriceMap[p.oz]?.hauptmaterial_preis
    );
    const complexLangtextPositions = calcResult.positions.filter(p =>
      p.modus !== 'header' && p.modus !== 'unknown' &&
      p.confidence < 0.7 && p.long_text && p.long_text.length > 50
    );

    // AI-classify unknown positions AND estimate Y/Z/X
    for (const pos of unknownPositions) {
      try {
        const aiClass = await classifyWithAI(pos);
        if (!aiClass) continue;

        if (aiClass.validated && aiClass.category && aiClass.leistung) {
          // Maps to known Regelwerk → re-classify
          pos.classification = {
            id: `ai_${aiClass.leistung}`,
            category: aiClass.category,
            leistung: aiClass.leistung,
            modus: aiClass.modus || 'normal',
            confidence: Math.min(aiClass.confidence || 0.75, 0.85),
          };
          pos.modus = aiClass.modus || 'normal';
          pos.kommentare.push(`KI-Klassifizierung: ${aiClass.category}.${aiClass.leistung}`);
          aiStats.classified++;
        } else {
          // No Regelwerk match → use AI estimates directly for Y, Z, X
          pos.modus = aiClass.modus || 'normal';
          if (aiClass.arbeitszeit_schaetzung_min > 0) {
            pos.Y = aiClass.arbeitszeit_schaetzung_min;
            pos.time_minutes = aiClass.arbeitszeit_schaetzung_min;
            pos.EP_lohn = Math.round((pos.Y / 60) * mergedParams.stundensatz * 100) / 100;
            pos.kommentare.push(`KI-Arbeitszeit: ${pos.Y} min/${pos.unit}`);
          }
          if (aiClass.geraete_eur_h > 0) {
            pos.Z = aiClass.geraete_eur_h;
            pos.EP_geraet = Math.round((pos.Y / 60) * pos.Z * 100) / 100;
            pos.kommentare.push(`KI-Geräte: ${pos.Z} €/h`);
          }
          if (aiClass.ist_reine_arbeit) {
            pos.X = 0;
            pos.kommentare.push('KI: Reine Arbeitsleistung (X=0)');
          }
          // Recalculate EP/GP
          pos.EP = Math.round(((pos.EP_lohn || 0) + (pos.EP_material || 0) + (pos.EP_geraet || 0) + (pos.EP_nu || 0)) * 100) / 100;
          pos.GP = Math.round(pos.EP * (pos.quantity || 0) * 100) / 100;
          pos.farbe = FARBEN.achtung; // rot — AI estimate
          aiStats.classified++;
        }
        if (aiClass.hinweise?.length > 0) {
          pos.kommentare.push(...aiClass.hinweise);
        }
        log('autoCalc', `  KI ${pos.oz}: Y=${pos.Y} Z=${pos.Z} X=${pos.X} modus=${pos.modus}`, {
          short_text: (pos.short_text || '').slice(0, 50),
          validated: aiClass.validated,
        });
      } catch (err) {
        log('autoCalc', `  KI Fehler ${pos.oz}: ${err.message}`, null, 'ERROR');
      }
    }

    // Also fill Y/Z via AI for classified positions that have Y=0 (no Regelwerk value)
    const missingYPositions = calcResult.positions.filter(p =>
      p.modus === 'normal' && p.Y === 0 && !p.is_header &&
      p.classification?.leistung && p.EP === 0
    );
    for (const pos of missingYPositions.slice(0, 10)) {
      try {
        const aiClass = await classifyWithAI(pos);
        if (aiClass?.arbeitszeit_schaetzung_min > 0) {
          pos.Y = aiClass.arbeitszeit_schaetzung_min;
          pos.time_minutes = aiClass.arbeitszeit_schaetzung_min;
          pos.Z = aiClass.geraete_eur_h || pos.Z || mergedParams.geraete_default;
          pos.EP_lohn = Math.round((pos.Y / 60) * mergedParams.stundensatz * 100) / 100;
          pos.EP_geraet = Math.round((pos.Y / 60) * pos.Z * 100) / 100;
          pos.EP = Math.round(((pos.EP_lohn || 0) + (pos.EP_material || 0) + (pos.EP_geraet || 0)) * 100) / 100;
          pos.GP = Math.round(pos.EP * (pos.quantity || 0) * 100) / 100;
          pos.kommentare.push(`KI-Arbeitszeit: ${pos.Y} min/${pos.unit} (Z=${pos.Z})`);
          pos.farbe = FARBEN.achtung;
          log('autoCalc', `  KI Y-Fill ${pos.oz}: Y=${pos.Y} Z=${pos.Z}`, { short_text: (pos.short_text || '').slice(0, 50) });
        }
      } catch (err) {
        log('autoCalc', `  KI Y-Fill Fehler ${pos.oz}: ${err.message}`, null, 'ERROR');
      }
    }

    // AI Langtext deep-analysis for low-confidence positions
    for (const pos of complexLangtextPositions.slice(0, 10)) { // max 10 to control costs
      try {
        const aiLangtext = await analyzeLangtextWithAI(pos);
        if (aiLangtext?.dimensionen) {
          // Merge AI-found dimensions with existing ones
          for (const [key, val] of Object.entries(aiLangtext.dimensionen)) {
            if (val !== null && !pos.dimensions?.[key]) {
              if (!pos.dimensions) pos.dimensions = {};
              pos.dimensions[key] = val;
            }
          }
          pos.kommentare.push('KI-Langtext-Analyse: Dimensionen ergänzt');
          aiStats.langtextAnalyzed++;
        }
        if (aiLangtext?.materialien?.length > 0) {
          const matNames = aiLangtext.materialien.map(m => m.bezeichnung).join(', ');
          pos.kommentare.push(`KI: Materialien erkannt — ${matNames}`);
        }
      } catch (err) {
        console.error('AI langtext error:', err);
      }
    }

    // AI price estimation for positions without any price
    for (const pos of unpricedPositions.slice(0, 15)) { // max 15 to control costs
      try {
        const aiPrice = await findPriceWithAI(
          pos.short_text,
          pos.unit,
          pos.long_text || ''
        );
        if (aiPrice?.preis > 0) {
          pos.X = Math.round(aiPrice.preis * 100) / 100;
          pos.EP_material = Math.round(pos.X * (1 + mergedParams.zuschlag_material) * 100) / 100;
          pos.EP = Math.round((pos.EP_lohn + pos.EP_material + pos.EP_geraet + pos.EP_nu) * 100) / 100;
          pos.GP = Math.round(pos.EP * pos.quantity * 100) / 100;
          pos.farbe = FARBEN.achtung; // red — AI estimate, needs review
          pos.quellen.push(aiPrice.quelle);
          pos.kommentare.push(
            `KI-Preis: ${aiPrice.preis} €/${aiPrice.einheit} (${aiPrice.vertrauen})` +
            (aiPrice.spanne ? ` [${aiPrice.spanne.von}–${aiPrice.spanne.bis}]` : '')
          );
          aiStats.priced++;
        }
      } catch (err) {
        console.error('AI price error:', err);
      }
    }

    // If AI classified or priced positions, re-calculate entire project
    if (aiStats.classified > 0 || aiStats.priced > 0) {
      const reCalc = calculateProject(positions, mergedParams, safePriceMap);
      // Replace positions AND summary with fresh calculation
      calcResult.positions = reCalc.positions;
      calcResult.summary = reCalc.summary;
      calcResult.warnings = reCalc.warnings;
    }
  }

  if (onProgress) onProgress('ai_done', positions.length, positions.length);

  // ─── Phase 3: Plausibility checks ───────────────────────────
  log('autoCalc', 'Phase 3 — Plausibilitätsprüfung');
  const plausi = checkProject(calcResult.positions, calcResult.summary);

  if (onProgress) onProgress('plausi', positions.length, positions.length);

  // ─── Phase 4: Compile stats ─────────────────────────────────
  const stats = {
    totalPositions: calcResult.summary.totalPositions,
    classified: calcResult.summary.classified,
    unclassified: calcResult.summary.unclassified,
    classificationRate: calcResult.summary.totalPositions > 0
      ? Math.round(calcResult.summary.classified / calcResult.summary.totalPositions * 100)
      : 0,

    withAngebot: Object.keys(safePriceMap).length,
    withSirados: calcResult.siradosHits || 0,
    withAI: aiStats.classified + aiStats.priced,
    aiClassified: aiStats.classified,
    aiPriced: aiStats.priced,
    aiLangtextAnalyzed: aiStats.langtextAnalyzed,
    missingPrices: calcResult.positions.filter(p =>
      p.modus === 'normal' && p.X === 0 && !p.materialDecomposition?.X_rein_arbeit
    ).length,

    plausi_fails: plausi.stats.totalFails,
    plausi_warns: plausi.stats.totalWarns,
    plausi_passed: plausi.stats.passed,

    duration_ms: Date.now() - startTime,
  };

  // ─── Phase 5: Mark positions with plausi results ─────────────
  for (const pos of calcResult.positions) {
    if (pos.modus === 'header') continue;
    const check = plausi.positionChecks.get(pos.oz);
    if (check) {
      pos.plausi_fails = check.fails;
      pos.plausi_warns = check.warns;
      // Override color to red if FAILs exist
      if (check.fails.length > 0) {
        pos.farbe = FARBEN.achtung;
      }
    }
  }

  if (onProgress) onProgress('done', positions.length, positions.length);

  log('autoCalc', '═══ AUTO-KALKULATION FERTIG ═══', {
    dauer_ms: Date.now() - startTime,
    totalGP: calcResult.summary.totalGP,
    lohn_pct: calcResult.summary.anteil_lohn,
    material_pct: calcResult.summary.anteil_material,
    geraet_pct: calcResult.summary.anteil_geraet,
    nu_pct: calcResult.summary.anteil_nu,
    fails: plausi.stats.totalFails,
    warns: plausi.stats.totalWarns,
    angebotPreise: stats.withAngebot,
    siradosTreffer: stats.withSirados,
    kiPreise: stats.aiPriced,
    fehlend: stats.missingPrices,
  });

  return {
    positions: calcResult.positions,
    summary: calcResult.summary,
    plausi,
    stats,
    projectChecks: plausi.projectChecks,
    warnings: calcResult.warnings,
  };
}

/**
 * Quick summary before running full auto-calc
 * Shows what will happen
 */
export function previewAutoCalc(positions) {
  const headers = positions.filter(p => p.is_header).length;
  const active = positions.length - headers;

  return {
    totalPositions: positions.length,
    headers,
    activePositions: active,
    message: `${active} Positionen werden automatisch kalkuliert`,
  };
}
