/**
 * KALKU-KI Excel-Export
 *
 * Supports two export formats:
 * 1. exportKalkulation — Simple EP calculation export
 * 2. exportAnalyse — Position list export
 * 3. exportLV3 — Full LV3-Format with X/Y/Z/M/AA + Farbcodes + Kommentare (Leitfaden §9)
 *
 * Farbcode (Leitfaden §0.5):
 *   E2EFDA grün  — belegt durch konkretes Angebot
 *   FFF2CC gelb  — Annahme, Erfahrungspreis, Preisdatenbank
 *   F8CBAD rot   — unsicher, vor Abgabe zwingend prüfen
 */

import * as XLSX from 'xlsx';

// ─── FARBCODES (Leitfaden §0.5) ─────────────────────────────────
const FARBEN_HEX = {
  angebot:  'E2EFDA', // grün
  annahme:  'FFF2CC', // gelb
  achtung:  'F8CBAD', // rot
  header:   'D9E2F3', // blau-grau für Überschriften
  plausi_fail: 'FF9999', // hellrot für Plausi-Fehler
};

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function sanitizeFilename(name) {
  if (!name) return 'Projekt';
  return name
    .replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

function getFormattedDate() {
  return new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Map our internal farbe hex to Leitfaden category
 */
function farbeToCategory(farbe) {
  if (!farbe) return 'annahme';
  const clean = (farbe || '').replace('#', '').toUpperCase();
  if (clean === 'E2EFDA') return 'angebot';
  if (clean === 'FFF2CC') return 'annahme';
  if (clean === 'F8CBAD') return 'achtung';
  return 'annahme';
}

/**
 * Build traceability comment for a position (Leitfaden §9)
 * Each cell comment contains: Herleitung + Quelle + Regel-Nr
 */
function buildTraceComment(pos) {
  const lines = [];

  // Classification
  if (pos.classification?.category && pos.classification?.leistung) {
    lines.push(`Regel: ${pos.classification.category}.${pos.classification.leistung}`);
  }

  // Calculation trace
  if (pos.modus === 'vorhalten' && pos.AA != null) {
    lines.push(`Modus: Vorhalten (AA-Override = ${pos.AA} €)`);
  } else if (pos.modus === 'nu') {
    lines.push(`Modus: NU (M=${pos.M} €, Y=0)`);
  } else if (pos.modus === 'zulage') {
    lines.push(`Modus: Zulage (nur Differenz)`);
  } else {
    if (pos.Y > 0) lines.push(`Y=${pos.Y} min/${pos.unit} → Lohn=${pos.EP_lohn?.toFixed(2)} €`);
    if (pos.Z > 0) lines.push(`Z=${pos.Z} €/h → Gerät=${pos.EP_geraet?.toFixed(2)} €`);
    if (pos.X > 0) lines.push(`X=${pos.X} €/${pos.unit} → Material=${pos.EP_material?.toFixed(2)} €`);
  }

  // Sources
  if (pos.quellen?.length > 0) {
    lines.push(`Quellen: ${pos.quellen.join('; ')}`);
  }

  // Kommentare (modifiers, AI hints, etc.)
  if (pos.kommentare?.length > 0) {
    for (const k of pos.kommentare) {
      lines.push(k);
    }
  }

  // Plausi results
  if (pos.plausi_fails?.length > 0) {
    lines.push(`PLAUSI FAIL: ${pos.plausi_fails.map(f => f.message).join('; ')}`);
  }
  if (pos.plausi_warns?.length > 0) {
    lines.push(`PLAUSI WARN: ${pos.plausi_warns.map(w => w.message).join('; ')}`);
  }

  // Confidence
  if (pos.confidence > 0) {
    lines.push(`Konfidenz: ${Math.round(pos.confidence * 100)}%`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT 1: Simple Kalkulation
// ═══════════════════════════════════════════════════════════════════
export function exportKalkulation(data, projektname) {
  if (!data || !data.rows) {
    throw new Error('Keine Kalkulationsdaten übergeben.');
  }

  const wb = XLSX.utils.book_new();
  const cleanName = sanitizeFilename(projektname);

  const wsData = [
    ['KALKU-KI Kalkulation'],
    [`Projekt: ${projektname || 'Ohne Bezeichnung'}`],
    [`Datum: ${getFormattedDate()}`],
    [],
    ['Position / Beschreibung', 'je ME (EUR)', 'Menge', 'Gesamt (EUR)'],
  ];

  for (const row of data.rows) {
    wsData.push([
      row.label || '',
      typeof row.perUnit === 'number' ? row.perUnit : '',
      typeof row.qty === 'number' ? row.qty : '',
      typeof row.total === 'number' ? row.total : '',
    ]);
  }

  wsData.push([]);
  wsData.push(['Einheitspreis (EP)', '', '', data.ep || 0]);
  wsData.push(['Gesamtpreis (GP)', '', '', data.gesamtpreis || 0]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 5; r <= range.e.r; r++) {
    for (const c of [1, 3]) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
        ws[cellAddr].z = '#,##0.00';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Kalkulation');
  const filename = `KALKU_${cleanName}_${getTimestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT 2: Analyse (Position list)
// ═══════════════════════════════════════════════════════════════════
export function exportAnalyse(positions, projektname) {
  if (!positions || !Array.isArray(positions)) {
    throw new Error('Keine Positionsdaten übergeben.');
  }

  const wb = XLSX.utils.book_new();
  const cleanName = sanitizeFilename(projektname);

  const wsData = [
    ['KALKU-KI Analyse'],
    [`Projekt: ${projektname || 'Ohne Bezeichnung'}`],
    [`Datum: ${getFormattedDate()}`],
    [],
    ['OZ', 'Kurztext', 'Menge', 'Einheit', 'EP (EUR)', 'GP (EUR)'],
  ];

  let gesamtSumme = 0;
  for (const pos of positions) {
    const ep = pos.ep != null ? Number(pos.ep) : null;
    const qty = Number(pos.qty) || 0;
    const gp = ep != null ? Math.round(ep * qty * 100) / 100 : null;
    if (gp != null) gesamtSumme += gp;
    wsData.push([
      pos.oz || '', pos.text || '', qty, pos.unit || '',
      ep != null ? ep : '', gp != null ? gp : '',
    ]);
  }

  wsData.push([]);
  wsData.push(['', '', '', '', 'Gesamtsumme:', Math.round(gesamtSumme * 100) / 100]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }];

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 5; r <= range.e.r; r++) {
    for (const c of [4, 5]) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
        ws[cellAddr].z = '#,##0.00';
      }
    }
    const qtyAddr = XLSX.utils.encode_cell({ r, c: 2 });
    if (ws[qtyAddr] && typeof ws[qtyAddr].v === 'number') {
      ws[qtyAddr].z = '#,##0.000';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Analyse');
  const filename = `KALKU_Analyse_${cleanName}_${getTimestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT 3: LV3-Format (Leitfaden-konform)
//
// Spaltenstruktur nach Leitfaden §0.4:
//   A=Pos, B=Bezeichnung, C=Menge, D=Einheit,
//   E=EP, F=GP, G=Modus, H=Kategorie,
//   I=X(Stoffe EK), J=Y(min), K=Z(€/h), L=M(NU EK), M=AA(Override),
//   N=EP_Lohn, O=EP_Material, P=EP_Gerät, Q=EP_NU,
//   R=Farbe, S=Quellen, T=Kommentar/Traceability
//
// Farbcodes: grün=Angebot, gelb=Annahme, rot=unsicher
// Jede Zelle mit Traceability-Kommentar (Leitfaden §9)
// ═══════════════════════════════════════════════════════════════════
export function exportLV3(calcPositions, projektname, summary, plausiResult) {
  if (!calcPositions || !Array.isArray(calcPositions)) {
    throw new Error('Keine kalkulierten Positionen übergeben.');
  }

  const wb = XLSX.utils.book_new();
  const cleanName = sanitizeFilename(projektname);

  // ─── Sheet 1: Kalkulation (LV3-Format) ────────────────────────
  const wsData = [
    [`KALKU-KI Vorkalkulation — ${projektname || 'Ohne Bezeichnung'}`],
    [`Datum: ${getFormattedDate()} | Stundensatz: 72,51 €/h | Zuschlag Material/NU: 20%`],
    [`Preisquellen: Angebote (grün) → Preisdatenbank (gelb) → KB Erfahrungspreise (gelb) → Web (rot)`],
    [],
    // Column headers
    [
      'Pos',           // A
      'Bezeichnung',   // B
      'Menge',         // C
      'Einheit',       // D
      'EP (€)',        // E
      'GP (€)',        // F
      'Modus',         // G
      'Kategorie',     // H
      'X Stoffe EK',   // I — Material EUR/Einheit
      'Y min/ME',      // J — Arbeitsminuten
      'Z €/h',         // K — Gerätezulage
      'M NU EK',       // L — NU-Preis
      'AA Override',   // M — Vorhalte-Override
      'EP Lohn',       // N
      'EP Material',   // O
      'EP Gerät',      // P
      'EP NU',         // Q
      'Farbe',         // R
      'Quellen',       // S
      'Kommentar / Traceability',  // T — Leitfaden §9
    ],
  ];

  let totalGP = 0;
  let totalLohn = 0;
  let totalMaterial = 0;
  let totalGeraet = 0;
  let totalNU = 0;

  for (const pos of calcPositions) {
    if (pos.modus === 'header') {
      // Section header row
      wsData.push([
        pos.oz || '', pos.short_text || '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      ]);
      continue;
    }

    const gp = pos.GP || 0;
    totalGP += gp;
    totalLohn += (pos.EP_lohn || 0) * (pos.quantity || 0);
    totalMaterial += (pos.EP_material || 0) * (pos.quantity || 0);
    totalGeraet += (pos.EP_geraet || 0) * (pos.quantity || 0);
    totalNU += (pos.EP_nu || 0) * (pos.quantity || 0);

    const farbKat = farbeToCategory(pos.farbe);
    const comment = buildTraceComment(pos);

    wsData.push([
      pos.oz || '',                                    // A
      pos.short_text || '',                            // B
      pos.quantity || 0,                               // C
      pos.unit || '',                                  // D
      pos.EP || 0,                                     // E
      gp,                                              // F
      pos.modus || '',                                 // G
      pos.classification ? `${pos.classification.category || ''}.${pos.classification.leistung || ''}` : '', // H
      pos.X || 0,                                      // I
      pos.Y || 0,                                      // J
      pos.Z || 0,                                      // K
      pos.M || 0,                                      // L
      pos.AA != null ? pos.AA : '',                    // M
      pos.EP_lohn || 0,                                // N
      pos.EP_material || 0,                            // O
      pos.EP_geraet || 0,                              // P
      pos.EP_nu || 0,                                  // Q
      farbKat,                                         // R
      (pos.quellen || []).join('; '),                   // S
      comment,                                         // T
    ]);
  }

  // Summary rows
  wsData.push([]);
  wsData.push(['', 'SUMMEN', '', '', '', totalGP, '', '',
    '', '', '', '', '', totalLohn, totalMaterial, totalGeraet, totalNU, '', '', '']);
  wsData.push([]);

  // Percentage distribution
  if (totalGP > 0) {
    wsData.push(['', 'ANTEILE (%)', '', '', '', '100%', '', '',
      '', '', '', '', '',
      `${(totalLohn / totalGP * 100).toFixed(1)}%`,
      `${(totalMaterial / totalGP * 100).toFixed(1)}%`,
      `${(totalGeraet / totalGP * 100).toFixed(1)}%`,
      `${(totalNU / totalGP * 100).toFixed(1)}%`,
      '', '', '']);
  }

  // Plausi summary
  if (plausiResult) {
    wsData.push([]);
    wsData.push(['', `PLAUSI: ${plausiResult.stats.totalFails} FAIL, ${plausiResult.stats.totalWarns} WARN`]);

    if (plausiResult.projectChecks?.length > 0) {
      for (const check of plausiResult.projectChecks) {
        wsData.push(['', `  [${check.severity}] ${check.rule}: ${check.message}`]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, // A Pos
    { wch: 50 }, // B Bezeichnung
    { wch: 10 }, // C Menge
    { wch: 8 },  // D Einheit
    { wch: 12 }, // E EP
    { wch: 14 }, // F GP
    { wch: 10 }, // G Modus
    { wch: 28 }, // H Kategorie
    { wch: 12 }, // I X
    { wch: 10 }, // J Y
    { wch: 8 },  // K Z
    { wch: 12 }, // L M
    { wch: 12 }, // M AA
    { wch: 12 }, // N EP_Lohn
    { wch: 12 }, // O EP_Material
    { wch: 12 }, // P EP_Gerät
    { wch: 12 }, // Q EP_NU
    { wch: 10 }, // R Farbe
    { wch: 30 }, // S Quellen
    { wch: 60 }, // T Kommentar
  ];

  // Number formats for currency columns
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 5; r <= range.e.r; r++) {
    // Currency columns: E, F, I, L, M, N, O, P, Q (indices 4,5,8,11,12,13,14,15,16)
    for (const c of [4, 5, 8, 11, 12, 13, 14, 15, 16]) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
        ws[cellAddr].z = '#,##0.00';
      }
    }
    // Minutes column J (index 9)
    const minAddr = XLSX.utils.encode_cell({ r, c: 9 });
    if (ws[minAddr] && typeof ws[minAddr].v === 'number') {
      ws[minAddr].z = '#,##0.0';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Kalkulation');

  // ─── Sheet 2: Plausi-Report ───────────────────────────────────
  if (plausiResult) {
    const plausiData = [
      ['KALKU-KI Plausi-Report'],
      [`Projekt: ${projektname || ''} | Datum: ${getFormattedDate()}`],
      [`Status: ${plausiResult.stats.totalFails === 0 ? 'BESTANDEN (0 FAIL)' : `NICHT BESTANDEN (${plausiResult.stats.totalFails} FAIL)`}`],
      [],
      ['Pos', 'Typ', 'Regel', 'Meldung'],
    ];

    // Position-level checks
    if (plausiResult.positionChecks) {
      for (const [oz, check] of plausiResult.positionChecks) {
        for (const fail of (check.fails || [])) {
          plausiData.push([oz, 'FAIL', fail.rule, fail.message]);
        }
        for (const warn of (check.warns || [])) {
          plausiData.push([oz, 'WARN', warn.rule, warn.message]);
        }
      }
    }

    // Project-level checks
    if (plausiResult.projectChecks?.length > 0) {
      plausiData.push([]);
      plausiData.push(['', '', '', 'PROJEKT-PRÜFUNGEN:']);
      for (const check of plausiResult.projectChecks) {
        plausiData.push(['PROJEKT', check.severity, check.rule, check.message]);
      }
    }

    const wsPlausi = XLSX.utils.aoa_to_sheet(plausiData);
    wsPlausi['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsPlausi, 'Plausi-Report');
  }

  // ─── Sheet 3: Preisquellen-Übersicht ──────────────────────────
  const quellenData = [
    ['Preisquellen-Übersicht'],
    [`Projekt: ${projektname || ''}`],
    [],
    ['Pos', 'Kurztext', 'Farbe', 'Quellen'],
  ];
  for (const pos of calcPositions) {
    if (pos.modus === 'header') continue;
    if (pos.quellen?.length > 0 || pos.farbe) {
      quellenData.push([
        pos.oz || '',
        (pos.short_text || '').substring(0, 60),
        farbeToCategory(pos.farbe),
        (pos.quellen || []).join('; '),
      ]);
    }
  }
  const wsQuellen = XLSX.utils.aoa_to_sheet(quellenData);
  wsQuellen['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsQuellen, 'Preisquellen');

  // Write file
  const filename = `LV3_kalkuliert_${cleanName}_${getTimestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
