/**
 * KALKU-KI Excel-Export
 * Verwendet SheetJS (xlsx) für die Erstellung von Excel-Dateien
 */

import * as XLSX from 'xlsx';

/**
 * Erzeugt einen formatierten Zeitstempel für Dateinamen
 * @returns {string} Zeitstempel im Format YYYYMMDD_HHmmss
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Bereinigt einen String für die Verwendung als Dateiname
 * @param {string} name - Rohname
 * @returns {string} Bereinigter Dateiname
 */
function sanitizeFilename(name) {
  if (!name) return 'Projekt';
  return name
    .replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

/**
 * Formatiert ein Datum für die Anzeige in der Tabelle
 * @returns {string} Datum im Format TT.MM.JJJJ
 */
function getFormattedDate() {
  return new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Exportiert eine Kalkulation als Excel-Datei
 *
 * Tabellenaufbau:
 *   Zeile 1: "KALKU-KI Kalkulation" (Überschrift)
 *   Zeile 2: "Projekt: {projektname}"
 *   Zeile 3: "Datum: {datum}"
 *   Zeile 4: (leer)
 *   Zeile 5: Spaltenüberschriften
 *   Zeile 6+: Datenzeilen
 *   Letzte Zeilen: EP und Gesamtpreis
 *
 * @param {Object} data
 * @param {Array<{ label: string, perUnit: number, qty: number, total: number }>} data.rows - Kalkulationszeilen
 * @param {number} data.ep - Einheitspreis
 * @param {number} data.gesamtpreis - Gesamtpreis
 * @param {string} projektname - Projektbezeichnung
 */
export function exportKalkulation(data, projektname) {
  if (!data || !data.rows) {
    throw new Error('Keine Kalkulationsdaten übergeben.');
  }

  const wb = XLSX.utils.book_new();
  const cleanName = sanitizeFilename(projektname);

  // Tabelleninhalt aufbauen
  const wsData = [
    ['KALKU-KI Kalkulation'],
    [`Projekt: ${projektname || 'Ohne Bezeichnung'}`],
    [`Datum: ${getFormattedDate()}`],
    [], // Leerzeile
    ['Position / Beschreibung', 'je ME (EUR)', 'Menge', 'Gesamt (EUR)'],
  ];

  // Datenzeilen
  for (const row of data.rows) {
    wsData.push([
      row.label || '',
      typeof row.perUnit === 'number' ? row.perUnit : '',
      typeof row.qty === 'number' ? row.qty : '',
      typeof row.total === 'number' ? row.total : '',
    ]);
  }

  // Zusammenfassung
  wsData.push([]); // Leerzeile
  wsData.push(['Einheitspreis (EP)', '', '', data.ep || 0]);
  wsData.push(['Gesamtpreis (GP)', '', '', data.gesamtpreis || 0]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Spaltenbreiten setzen
  ws['!cols'] = [
    { wch: 25 }, // Position / Beschreibung
    { wch: 15 }, // je ME
    { wch: 12 }, // Menge
    { wch: 15 }, // Gesamt
  ];

  // Zahlenformat für Währungsspalten setzen
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

  // Datei herunterladen
  const filename = `KALKU_${cleanName}_${getTimestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}

/**
 * Exportiert eine GAEB-Analyse / Positionsliste als Excel-Datei
 *
 * Tabellenaufbau:
 *   Zeile 1: "KALKU-KI Analyse" (Überschrift)
 *   Zeile 2: "Projekt: {projektname}"
 *   Zeile 3: "Datum: {datum}"
 *   Zeile 4: (leer)
 *   Zeile 5: Spaltenüberschriften
 *   Zeile 6+: Positionszeilen
 *
 * @param {Array<{ oz: string, text: string, qty: number, unit: string, ep: number|null }>} positions
 * @param {string} projektname - Projektbezeichnung
 */
export function exportAnalyse(positions, projektname) {
  if (!positions || !Array.isArray(positions)) {
    throw new Error('Keine Positionsdaten übergeben.');
  }

  const wb = XLSX.utils.book_new();
  const cleanName = sanitizeFilename(projektname);

  // Tabelleninhalt
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

    if (gp != null) {
      gesamtSumme += gp;
    }

    wsData.push([
      pos.oz || '',
      pos.text || '',
      qty,
      pos.unit || '',
      ep != null ? ep : '',
      gp != null ? gp : '',
    ]);
  }

  // Summenzeile
  wsData.push([]);
  wsData.push(['', '', '', '', 'Gesamtsumme:', Math.round(gesamtSumme * 100) / 100]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Spaltenbreiten
  ws['!cols'] = [
    { wch: 12 }, // OZ
    { wch: 45 }, // Kurztext
    { wch: 12 }, // Menge
    { wch: 8 },  // Einheit
    { wch: 14 }, // EP
    { wch: 16 }, // GP
  ];

  // Zahlenformat für Währungsspalten
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 5; r <= range.e.r; r++) {
    for (const c of [4, 5]) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
        ws[cellAddr].z = '#,##0.00';
      }
    }
    // Mengenformat
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
