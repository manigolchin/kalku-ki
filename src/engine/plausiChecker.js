/**
 * PLAUSI CHECKER — Plausibility validation for calculated positions
 *
 * Implements rules from rules.json + Leitfaden consistency checks.
 * Returns FAIL (must fix) and WARN (review) for each position.
 */

import { GALABAU, FIRMA_DEFAULTS } from './regelwerk.js';

// ─── PLAUSIBILITY CORRIDORS (Leitfaden §8.2) ─────────────────────
const CORRIDORS = {
  lohn:     { min: 35, max: 50 }, // % of GP — Leitfaden §8.2
  material: { min: 20, max: 40 }, // Stoffe
  nu:       { min: 5,  max: 25 }, // Nachunternehmer
  geraet:   { min: 5,  max: 20 }, // Geräte
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

  // ─── Rule: Pflege-Positionen brauchen m²/AG-spezifische Raten ──
  if (classId.includes('waessern') || classId.includes('maehen') ||
      classId.includes('duengen') || classId.includes('fertigstellungspflege')) {
    if (calcResult.Y === 15 && calcResult.Z === 5) {
      fails.push({
        rule: 'pflege_default_verboten',
        message: `Pflege-Position: Y=15/Z=5 ist der RIESEN-Default — Pflege braucht m²/AG-spezifische Raten (CLAUDE.md Phase 2 Punkt 13)`,
      });
    }
    if (calcResult.Y === 0) {
      warns.push({
        rule: 'pflege_Y_null',
        message: `Pflege-Position: Y=0 ist unwahrscheinlich — Pflegearbeiten brauchen Arbeitszeit`,
      });
    }
  }

  // ─── Rule: Default Y=15 Z=5 is a red flag (CLAUDE.md Phase 2 Punkt 12) ──
  if (calcResult.Y === 15 && calcResult.Z === 5 && calcResult.modus === 'normal') {
    // Only warn if this is not a legitimate combination (e.g. Bordstein setzen = Y=15 Z=5)
    if (!classId.includes('bordstein') && !classId.includes('tiefbord')) {
      warns.push({
        rule: 'default_Y15_Z5_warnsignal',
        message: `Y=15 Z=5 könnte Default sein — CLAUDE.md: "mehrere Positionen mit diesem Default = Fehler"`,
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

  // ─── Konsistenz-Kette: Rohre DN (größerer DN >= kleinerer DN EP) ──
  const rohreByDN = [];
  for (const result of calcResults) {
    if (result.dimensions?.dn > 0 && result.EP > 0 &&
        (result.classification?.leistung?.includes('rohr') || result.short_text?.toLowerCase().includes('rohr'))) {
      rohreByDN.push({ dn: result.dimensions.dn, EP: result.EP, oz: result.oz });
    }
  }
  rohreByDN.sort((a, b) => a.dn - b.dn);
  for (let i = 1; i < rohreByDN.length; i++) {
    if (rohreByDN[i].EP < rohreByDN[i-1].EP) {
      projectChecks.push({
        rule: 'konsistenz_rohre_dn',
        severity: 'FAIL',
        message: `Rohre DN${rohreByDN[i].dn} (${rohreByDN[i].EP}€, Pos ${rohreByDN[i].oz}) günstiger als DN${rohreByDN[i-1].dn} (${rohreByDN[i-1].EP}€, Pos ${rohreByDN[i-1].oz}) — prüfen`,
      });
      totalFails++;
    }
  }

  // ─── Konsistenz-Kette: Bäume Stammumfang (größerer StU >= kleinerer StU EP) ──
  const baeumeByStU = [];
  for (const result of calcResults) {
    if (result.dimensions?.stammumfang_von > 0 && result.EP > 0 &&
        (result.classification?.leistung?.includes('baum') || result.short_text?.toLowerCase().includes('baum'))) {
      baeumeByStU.push({ stu: result.dimensions.stammumfang_von, EP: result.EP, oz: result.oz });
    }
  }
  baeumeByStU.sort((a, b) => a.stu - b.stu);
  for (let i = 1; i < baeumeByStU.length; i++) {
    if (baeumeByStU[i].EP < baeumeByStU[i-1].EP) {
      projectChecks.push({
        rule: 'konsistenz_baeume_stu',
        severity: 'FAIL',
        message: `Baum StU ${baeumeByStU[i].stu} (${baeumeByStU[i].EP}€, Pos ${baeumeByStU[i].oz}) günstiger als StU ${baeumeByStU[i-1].stu} (${baeumeByStU[i-1].EP}€, Pos ${baeumeByStU[i-1].oz}) — prüfen`,
      });
      totalFails++;
    }
  }

  // ─── Konsistenz-Kette: Bord-Typ (Rundbord > Hochbord > Tiefbord EP) ──
  const bordByTyp = {};
  for (const result of calcResults) {
    if (result.EP > 0 && result.dimensions?.bordstein_typ) {
      const typ = result.dimensions.bordstein_typ.substring(0, 2).toUpperCase();
      if (!bordByTyp[typ] || result.EP > bordByTyp[typ].EP) {
        bordByTyp[typ] = { EP: result.EP, oz: result.oz, typ: result.dimensions.bordstein_typ };
      }
    }
  }
  // Tiefbord (EF/TB low h) < Hochbord (TB/HB high h) < Rundbord (RB)
  const bordOrder = ['EF', 'TB', 'HB', 'RB'];
  for (let i = 0; i < bordOrder.length - 1; i++) {
    const lower = bordByTyp[bordOrder[i]];
    const higher = bordByTyp[bordOrder[i + 1]];
    if (lower && higher && higher.EP < lower.EP) {
      projectChecks.push({
        rule: 'konsistenz_bord_typ',
        severity: 'FAIL',
        message: `Bord ${higher.typ} (${higher.EP}€, Pos ${higher.oz}) günstiger als ${lower.typ} (${lower.EP}€, Pos ${lower.oz}) — prüfen`,
      });
      totalFails++;
    }
  }

  // ─── Konsistenz-Kette: Schüttgüter Festigkeit (höhere Festigkeit teurer) ──
  const schuettByFest = [];
  for (const result of calcResults) {
    if (result.EP > 0 && result.dimensions?.beton_c > 0) {
      schuettByFest.push({ fest: result.dimensions.beton_c, EP: result.EP, oz: result.oz });
    }
  }
  schuettByFest.sort((a, b) => a.fest - b.fest);
  for (let i = 1; i < schuettByFest.length; i++) {
    if (schuettByFest[i].EP < schuettByFest[i-1].EP) {
      projectChecks.push({
        rule: 'konsistenz_schuettgut_festigkeit',
        severity: 'FAIL',
        message: `Beton C${schuettByFest[i].fest} (${schuettByFest[i].EP}€, Pos ${schuettByFest[i].oz}) günstiger als C${schuettByFest[i-1].fest} (${schuettByFest[i-1].EP}€, Pos ${schuettByFest[i-1].oz}) — prüfen`,
      });
      totalFails++;
    }
  }

  // ─── Coverage-Gate: Positionen ohne Regel-Match = FAIL ────────
  const uncoveredPositions = [];
  for (const result of calcResults) {
    if (result.modus === 'header') continue;
    if (result.modus === 'unknown' && !result.classification?.category) {
      uncoveredPositions.push(result.oz);
    }
  }
  if (uncoveredPositions.length > 0) {
    const ratio = uncoveredPositions.length / summary.totalPositions;
    projectChecks.push({
      rule: 'coverage_gate',
      severity: ratio > 0.1 ? 'FAIL' : 'WARN',
      message: `${uncoveredPositions.length} Positionen ohne Regel-Match (Coverage-Gap): ${uncoveredPositions.slice(0, 10).join(', ')}${uncoveredPositions.length > 10 ? ` ... (+${uncoveredPositions.length - 10} weitere)` : ''}`,
    });
    if (ratio > 0.1) totalFails++;
  }

  // ─── Default Y=15 Z=5 Häufung = Fehler (CLAUDE.md Phase 2 Punkt 12) ──
  let defaultCount = 0;
  for (const result of calcResults) {
    if (result.modus === 'normal' && result.Y === 15 && result.Z === 5) {
      defaultCount++;
    }
  }
  if (defaultCount >= 3) {
    projectChecks.push({
      rule: 'default_haeufung',
      severity: 'FAIL',
      message: `${defaultCount} Positionen haben Y=15/Z=5 — das ist der gefürchtete Default-Fehler (CLAUDE.md: "RIESEN-Warnsignal")`,
    });
    totalFails++;
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
