/**
 * PLAUSI CHECKER — Plausibility validation for calculated positions
 *
 * Implements rules from rules.json + Leitfaden consistency checks.
 * Returns FAIL (must fix) and WARN (review) for each position.
 */

import { GALABAU, FIRMA_DEFAULTS } from './regelwerk.js';

// ─── PLAUSIBILITY CORRIDORS ───────────────────────────────────────
const CORRIDORS = {
  lohn:     { min: 25, max: 55 }, // % of GP
  material: { min: 15, max: 45 },
  nu:       { min: 0,  max: 30 },
  geraet:   { min: 0,  max: 25 },
};

// ─── SINGLE POSITION CHECKS ──────────────────────────────────────

/**
 * Check a single calculated position for plausibility
 * @param {Object} calcResult - Result from calculator.calculatePosition
 * @returns {{ fails: Array, warns: Array }}
 */
export function checkPosition(calcResult) {
  const fails = [];
  const warns = [];

  if (calcResult.modus === 'header') return { fails, warns };

  // ─── Rule: Vorhalten X must be empty ─────────────────────────
  if (calcResult.modus === 'vorhalten') {
    if (calcResult.X > 0) {
      fails.push({
        rule: 'vorhalten_X_empty',
        message: 'Vorhalte-Position: X muss leer sein (Wert gehört in AA-Override)',
      });
    }
    if (calcResult.Y > 0) {
      fails.push({
        rule: 'vorhalten_Y_zero',
        message: 'Vorhalte-Position: Y muss 0 sein',
      });
    }
    if (!calcResult.AA && calcResult.AA !== 0) {
      fails.push({
        rule: 'vorhalten_AA_empty',
        message: 'Vorhalte-Position: AA muss als Override gefüllt sein',
      });
    }
    return { fails, warns };
  }

  // ─── Rule: NU-Position X empty, Y=0 ─────────────────────────
  if (calcResult.modus === 'nu') {
    if (calcResult.M === 0) {
      fails.push({
        rule: 'nu_M_empty',
        message: 'NU-Position: Spalte M muss gefüllt sein (NU-Preis fehlt)',
      });
    }
    if (calcResult.Y > 0) {
      fails.push({
        rule: 'nu_Y_not_zero',
        message: 'NU-Position: Y muss 0 sein (Montage im NU-Preis)',
      });
    }
    return { fails, warns };
  }

  // ─── Rule: Zulage — X should be difference only ──────────────
  if (calcResult.modus === 'zulage') {
    if (calcResult.Y > 0 && calcResult.X > 0) {
      warns.push({
        rule: 'zulage_Y_pruefen',
        message: `Zulage: Y=${calcResult.Y} — sicher, dass Zusatzzeit nötig? Meist nur Materialtausch (Y=0)`,
      });
    }
    return { fails, warns };
  }

  // ─── Rule: Schneidarbeiten X must be empty ────────────────────
  const classId = calcResult.classification?.id || '';
  if (classId.includes('schneiden') || classId.includes('anpassen')) {
    if (calcResult.X > 0) {
      fails.push({
        rule: 'schneiden_X_empty',
        message: 'Schneidarbeiten: X muss leer sein (kein Material)',
      });
    }
    if (calcResult.Z !== 15) {
      warns.push({
        rule: 'schneiden_Z_15',
        message: `Schneidarbeiten: Z sollte 15 EUR/h sein (Nassschneider), ist ${calcResult.Z}`,
      });
    }
  }

  // ─── Rule: Pure labor positions X must be 0 ───────────────────
  const reine_arbeit_ids = [
    'oberboden_abtragen', 'aushub_grossmaschine', 'aushub_handarbeit',
    'aushub_minibagger', 'einbau_verdichten', 'transport_erdmassen',
    'planieren', 'abbruch',
  ];
  if (reine_arbeit_ids.some(ra => classId.includes(ra))) {
    if (calcResult.X > 0) {
      warns.push({
        rule: 'arbeit_X_null',
        message: `Reine Arbeitsleistung: X sollte 0 sein, ist ${calcResult.X}`,
      });
    }
  }

  // ─── Rule: Asphalt is not Erdmasse ────────────────────────────
  if (classId === 'asphalt_aufnehmen') {
    if (calcResult.Y < 10) {
      fails.push({
        rule: 'asphalt_nicht_erdmasse',
        message: `Asphalt aufnehmen: Y muss >= 10 min/m³ sein (ist ${calcResult.Y}). Asphalt ist FEST, nicht Erdmasse!`,
      });
    }
  }

  // ─── Rule: Bordstein with Fundament X minimum ─────────────────
  if (classId.includes('bordstein_fundament')) {
    if (calcResult.X < 20) {
      fails.push({
        rule: 'bordstein_fundament_X_min',
        message: `Bordstein inkl. Fundament+Rückenstütze: X muss >= 20 EUR/lfm sein (0.10 m³ × 200 €/m³ Beton), ist ${calcResult.X}`,
      });
    }
    if (calcResult.Y < 19) {
      warns.push({
        rule: 'bordstein_fundament_Y_min',
        message: `Bordstein inkl. Fundament: Y sollte >= 19 min/lfm sein (12 Bord + 7 Aushub), ist ${calcResult.Y}`,
      });
    }
  }

  // ─── Rule: Pflaster minimum ──────────────────────────────────
  if (classId.includes('pflaster_verlegen') || classId === 'pflaster_standard') {
    if (calcResult.Y < 20) {
      warns.push({
        rule: 'pflaster_Y_min',
        message: `Pflaster: Y sollte >= 25 min/m² sein (Minimum 20), ist ${calcResult.Y}`,
      });
    }
    if (calcResult.Z !== 5) {
      warns.push({
        rule: 'pflaster_Z_5',
        message: `Pflaster: Z sollte 5 EUR/h sein (Rüttler), ist ${calcResult.Z}`,
      });
    }
  }

  // ─── Rule: Baum pflanzen minimum Y ───────────────────────────
  if (classId === 'baum_pflanzen') {
    if (calcResult.Y < 100) {
      warns.push({
        rule: 'baum_Y_min',
        message: `Baum pflanzen: Y sollte >= 120 min/St sein, ist ${calcResult.Y}`,
      });
    }
  }

  // ─── Rule: Spielgeräte Z=5 ──────────────────────────────────
  if (classId === 'spielgeraet') {
    if (calcResult.Z < 5) {
      warns.push({
        rule: 'spielgeraet_Z5',
        message: `Spielgerät: Z sollte mind. 5 EUR/h sein, ist ${calcResult.Z}`,
      });
    }
  }

  // ─── Rule: EP plausibility (general) ─────────────────────────
  if (calcResult.EP > 0 && calcResult.quantity > 0) {
    if (calcResult.EP > 5000) {
      warns.push({
        rule: 'ep_sehr_hoch',
        message: `EP = ${calcResult.EP} €/${calcResult.unit} — ungewöhnlich hoch, prüfen`,
      });
    }
    const gp = calcResult.GP;
    if (gp > 50000) {
      warns.push({
        rule: 'gp_sehr_hoch',
        message: `GP = ${gp.toLocaleString('de-DE')} € — Top-Position, sorgfältig prüfen`,
      });
    }
  }

  // ─── Rule: Confidence too low ────────────────────────────────
  if (calcResult.confidence < 0.5) {
    warns.push({
      rule: 'niedrige_konfidenz',
      message: `Klassifizierung unsicher (${Math.round(calcResult.confidence * 100)}%) — manuell prüfen`,
    });
  }

  return { fails, warns };
}


// ─── PROJECT-LEVEL CHECKS ─────────────────────────────────────────

/**
 * Run plausibility checks across all positions
 * @param {Array} calcResults - Results from calculateProject
 * @param {Object} summary - Project summary
 * @returns {{ positionChecks: Map, projectChecks: Array, stats: Object }}
 */
export function checkProject(calcResults, summary) {
  const positionChecks = new Map();
  let totalFails = 0;
  let totalWarns = 0;

  // Per-position checks
  for (const result of calcResults) {
    if (result.modus === 'header') continue;
    const check = checkPosition(result);
    positionChecks.set(result.oz, check);
    totalFails += check.fails.length;
    totalWarns += check.warns.length;
  }

  // Project-level checks
  const projectChecks = [];

  // Check cost distribution corridors
  if (summary.totalGP > 0) {
    if (summary.anteil_lohn < CORRIDORS.lohn.min || summary.anteil_lohn > CORRIDORS.lohn.max) {
      projectChecks.push({
        rule: 'korridor_lohn',
        severity: 'WARN',
        message: `Lohnanteil ${summary.anteil_lohn}% außerhalb Korridor (${CORRIDORS.lohn.min}-${CORRIDORS.lohn.max}%)`,
      });
    }
    if (summary.anteil_material < CORRIDORS.material.min || summary.anteil_material > CORRIDORS.material.max) {
      projectChecks.push({
        rule: 'korridor_material',
        severity: 'WARN',
        message: `Materialanteil ${summary.anteil_material}% außerhalb Korridor (${CORRIDORS.material.min}-${CORRIDORS.material.max}%)`,
      });
    }
  }

  // Check unclassified ratio
  if (summary.unclassified > 0) {
    const ratio = summary.unclassified / summary.totalPositions;
    if (ratio > 0.3) {
      projectChecks.push({
        rule: 'hoher_unklassifiziert',
        severity: 'WARN',
        message: `${summary.unclassified} von ${summary.totalPositions} Positionen nicht klassifiziert (${Math.round(ratio*100)}%)`,
      });
    }
  }

  // Consistency chains: same work type → same price
  const priceByType = new Map();
  for (const result of calcResults) {
    if (result.modus === 'header' || result.modus === 'unknown') continue;
    const key = result.classification?.leistung;
    if (!key) continue;
    if (!priceByType.has(key)) priceByType.set(key, []);
    priceByType.get(key).push({ oz: result.oz, EP: result.EP, Y: result.Y, text: result.short_text });
  }

  for (const [type, entries] of priceByType) {
    if (entries.length < 2) continue;
    const eps = entries.map(e => e.EP).filter(ep => ep > 0);
    if (eps.length < 2) continue;
    const maxEP = eps.reduce((a, b) => Math.max(a, b), 0);
    const minEP = eps.reduce((a, b) => Math.min(a, b), Infinity);
    if (minEP > 0 && maxEP / minEP > 1.5) {
      projectChecks.push({
        rule: 'konsistenz',
        severity: 'WARN',
        message: `Gleiche Leistung "${type}": EP variiert ${minEP.toFixed(2)} – ${maxEP.toFixed(2)} €/${entries[0].text}`,
      });
    }
  }

  // ─── Arbeitszeit-Hierarchie (cross-position Y checks) ────────
  const yByLeistung = {};
  for (const result of calcResults) {
    if (result.modus === 'header' || result.modus === 'unknown') continue;
    const key = result.classification?.leistung;
    if (key && result.Y > 0) {
      yByLeistung[key] = { Y: result.Y, oz: result.oz };
    }
  }

  // Einbau+Verdichten must be > Aushub (Leitfaden: mindestens doppelt)
  if (yByLeistung.einbau_grossmaschine && yByLeistung.aushub_grossmaschine
      && yByLeistung.einbau_grossmaschine.Y > 0 && yByLeistung.aushub_grossmaschine.Y > 0) {
    if (yByLeistung.einbau_grossmaschine.Y <= yByLeistung.aushub_grossmaschine.Y) {
      projectChecks.push({
        rule: 'hierarchie_einbau_aushub',
        severity: 'WARN',
        message: `Einbau+Verdichten (${yByLeistung.einbau_grossmaschine.Y} min) sollte > Aushub (${yByLeistung.aushub_grossmaschine.Y} min) sein — Einbauen ist aufwändiger!`,
      });
    }
  }

  // Feinplanum > Planum grob
  if (yByLeistung.rasen_saatbett && yByLeistung.planieren) {
    if (yByLeistung.rasen_saatbett.Y <= yByLeistung.planieren.Y) {
      projectChecks.push({
        rule: 'hierarchie_feinplanum',
        severity: 'WARN',
        message: `Saatbett/Feinplanum (${yByLeistung.rasen_saatbett.Y} min) sollte > Grobplanum (${yByLeistung.planieren.Y} min) sein`,
      });
    }
  }

  // Pflaster verlegen > Pflaster Abbruch
  if (yByLeistung.pflaster_standard && yByLeistung.abbruch_pflaster) {
    if (yByLeistung.pflaster_standard.Y <= yByLeistung.abbruch_pflaster.Y) {
      projectChecks.push({
        rule: 'hierarchie_pflaster',
        severity: 'WARN',
        message: `Pflaster verlegen (${yByLeistung.pflaster_standard.Y} min) sollte >> Pflaster Abbruch (${yByLeistung.abbruch_pflaster.Y} min) sein`,
      });
    }
  }

  // Bauzaun umsetzen > Bauzaun aufstellen
  if (yByLeistung.schutzzaun_versetzen && yByLeistung.schutzzaun_herstellen) {
    if (yByLeistung.schutzzaun_versetzen.Y > yByLeistung.schutzzaun_herstellen.Y) {
      // This is actually correct per Leitfaden (umsetzen=4-5 > aufstellen=2-3)
      // Only warn if backwards
    } else if (yByLeistung.schutzzaun_versetzen.Y >= yByLeistung.schutzzaun_herstellen.Y) {
      projectChecks.push({
        rule: 'hierarchie_bauzaun',
        severity: 'WARN',
        message: `Bauzaun versetzen (${yByLeistung.schutzzaun_versetzen.Y} min) sollte < herstellen (${yByLeistung.schutzzaun_herstellen.Y} min)`,
      });
    }
  }

  // ─── Detailed Consistency Ordering Rules ──────────────────────
  // Pflaster 12cm > 10cm > 8cm (EP)
  const pflasterByDicke = [];
  for (const result of calcResults) {
    if (result.classification?.leistung?.startsWith('pflaster_') && result.EP > 0) {
      const dicke = result.materialDecomposition?.hauptmaterial?.dicke_cm
        || result.dimensions?.pflaster_dicke_cm || 0;
      if (dicke > 0) pflasterByDicke.push({ dicke, EP: result.EP, oz: result.oz });
    }
  }
  pflasterByDicke.sort((a, b) => a.dicke - b.dicke);
  for (let i = 1; i < pflasterByDicke.length; i++) {
    if (pflasterByDicke[i].EP < pflasterByDicke[i-1].EP) {
      projectChecks.push({
        rule: 'konsistenz_pflaster_dicke',
        severity: 'WARN',
        message: `Pflaster ${pflasterByDicke[i].dicke}cm (${pflasterByDicke[i].EP}€) sollte teurer sein als ${pflasterByDicke[i-1].dicke}cm (${pflasterByDicke[i-1].EP}€)`,
      });
    }
  }

  // Pflanzen hierarchy: Hochstamm > Strauch > Heckenpflanze (EP)
  const pflanzenOrder = ['baum_pflanzen', 'strauch_pflanzen', 'hecke_pflanzen'];
  const pflanzenEPs = {};
  for (const result of calcResults) {
    const key = result.classification?.leistung;
    if (key && pflanzenOrder.includes(key) && result.EP > 0) {
      pflanzenEPs[key] = { EP: result.EP, oz: result.oz };
    }
  }
  for (let i = 0; i < pflanzenOrder.length - 1; i++) {
    const higher = pflanzenEPs[pflanzenOrder[i]];
    const lower = pflanzenEPs[pflanzenOrder[i + 1]];
    if (higher && lower && higher.EP <= lower.EP) {
      projectChecks.push({
        rule: 'konsistenz_pflanzen',
        severity: 'WARN',
        message: `${pflanzenOrder[i]} (${higher.EP}€) sollte teurer sein als ${pflanzenOrder[i+1]} (${lower.EP}€)`,
      });
    }
  }

  // Schwere Bauteile Y: Tor > Schacht > Zaunpfosten > Rinne
  const bauteileOrder = ['drehfluegeltuer', 'schacht_setzen', 'zaunpfosten', 'rinne_im_beton'];
  const bauteileYs = {};
  for (const result of calcResults) {
    const key = result.classification?.leistung;
    if (key && bauteileOrder.includes(key) && result.Y > 0) {
      bauteileYs[key] = { Y: result.Y, oz: result.oz };
    }
  }
  for (let i = 0; i < bauteileOrder.length - 1; i++) {
    const higher = bauteileYs[bauteileOrder[i]];
    const lower = bauteileYs[bauteileOrder[i + 1]];
    if (higher && lower && higher.Y <= lower.Y) {
      projectChecks.push({
        rule: 'konsistenz_bauteile_Y',
        severity: 'WARN',
        message: `${bauteileOrder[i]} (Y=${higher.Y}) sollte mehr Arbeitszeit haben als ${bauteileOrder[i+1]} (Y=${lower.Y})`,
      });
    }
  }

  return {
    positionChecks,
    projectChecks,
    stats: {
      totalFails,
      totalWarns,
      projectWarns: projectChecks.length,
      passed: totalFails === 0,
    },
  };
}
