/**
 * ANGEBOT EXTRACTOR — Reads supplier PDFs/images via Claude Vision API
 *
 * Handles: Digital PDFs, Scanned PDFs, Handwritten annotations
 * Uses Anthropic Claude API with vision to extract structured price data.
 */

import { log, logError } from './logger.js';

const EXTRACTION_PROMPT = `Du bist ein erfahrener Baukalkulator. Lies dieses Lieferanten-Angebot und extrahiere ALLE Materialien/Leistungen mit Preisen.

WICHTIG:
- Extrahiere JEDEN einzelnen Preis, auch Zuschläge (Energie, Maut, Diesel, Mindermenge, Vierachser/4A)
- Erkenne ob es ein reines Material-Angebot oder ein NU-Angebot mit Positionen ist
- Lies auch handschriftliche Notizen und Korrekturen (auch bei Scans!)
- Preise sind NETTO (ohne MwSt) sofern nicht anders angegeben
- Achte auf Einheiten: €/t, €/m², €/m³, €/lfm, €/St, pauschal
- ALTERNATIVPOSITIONEN: Markiere Alternativen mit "ist_alternative": true — NUR Hauptpositionen haben false
- NICHT LIEFERBAR: Wenn eine Position als "nicht lieferbar" / "nicht verfügbar" markiert ist → "verfuegbar": false
- FRACHT: Es können MEHRERE Frachtposten existieren (z.B. MEA Fracht + eibe Fracht). Erfasse ALLE.
- VIERACHSER-ZUSCHLAG (4A): Bei Schüttgütern gibt es oft einen Zuschlag pro Tonne für 4-Achs-LKW. Erfasse als Zuschlag.
- Bei handschriftlichen Preisen: Lies genau, oft steht der Preis neben dem gedruckten Text

Antworte NUR mit validem JSON (kein Markdown, kein Text davor/danach):
{
  "lieferant": "Firmenname",
  "datum": "YYYY-MM-DD",
  "angebots_nr": "falls vorhanden",
  "typ": "material_liste" oder "position_basiert" oder "gemischt",
  "gueltig_bis": "YYYY-MM-DD oder null",
  "fracht": [
    { "bezeichnung": "Fracht", "betrag_eur": 0, "frei_ab_eur": null, "per_t_eur": 0 }
  ],
  "energiekostenzuschlag_pct": null,
  "positionen": [
    {
      "pos_nr": "falls vorhanden, sonst null",
      "bezeichnung": "exakte Materialbezeichnung",
      "preis": 12.80,
      "einheit": "t",
      "menge_von": null,
      "menge_bis": null,
      "ist_alternative": false,
      "verfuegbar": true,
      "zuschlaege": [
        { "typ": "Energiezuschlag", "wert": 8.50, "einheit": "€/t" },
        { "typ": "Vierachser 4A", "wert": 2.60, "einheit": "€/t" }
      ],
      "mindermenge": { "schwelle": 6, "zuschlag_eur": 45.00 },
      "notizen": "handschriftliche Anmerkungen hier",
      "ust_satz": 19
    }
  ],
  "montage_pauschal_eur": null,
  "handschriftliche_notizen": ["alle handschriftlichen Notizen hier"]
}`;


// ─── API KEY STORAGE ──────────────────────────────────────────────

const API_KEY_STORAGE = 'kalku_claude_api_key';

export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function hasApiKey() {
  return !!getApiKey();
}


// ─── PDF TO IMAGES ────────────────────────────────────────────────

/**
 * Convert a PDF file to base64 images (one per page)
 * Uses pdfjs-dist which is already in the project
 */
async function pdfToImages(file) {
  const pdfjsLib = await import('pdfjs-dist');
  // Use Vite's ?url import to get bundled worker URL (CDN doesn't have v5.x)
  const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const images = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x for readability
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    images.push({ page: i, base64, mediaType: 'image/jpeg' });
    canvas.remove();
  }

  return images;
}

/**
 * Convert an image file to base64
 */
async function imageToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      const mediaType = file.type || 'image/jpeg';
      resolve([{ page: 1, base64, mediaType }]);
    };
    reader.readAsDataURL(file);
  });
}


// ─── CLAUDE VISION API ────────────────────────────────────────────

/**
 * Send images to Claude Vision API and extract Angebot data
 * @param {Array} images - [{ page, base64, mediaType }]
 * @returns {Object} Parsed Angebot data
 */
async function callClaudeVision(images) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Claude API Key nicht konfiguriert');

  // Build content array with all page images
  const content = [];
  for (const img of images) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    });
  }
  content.push({ type: 'text', text: EXTRACTION_PROMPT });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logError('angebot', `Claude API Fehler: ${response.status}`, { error: err.slice(0, 300) });
    throw new Error(`Claude API Fehler: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    logError('angebot', 'JSON-Parse fehlgeschlagen', { response: text.slice(0, 300) });
    throw new Error('Claude-Antwort konnte nicht als JSON geparst werden: ' + text.slice(0, 200));
  }
}


// ─── MAIN EXTRACTION FUNCTION ─────────────────────────────────────

/**
 * Extract Angebot data from a file (PDF or image)
 * @param {File} file - The uploaded file
 * @param {Function} onProgress - Progress callback
 * @returns {Object} Structured Angebot data with calculated effective prices
 */
export async function extractAngebot(file, onProgress) {
  log('angebot', `═══ PDF-EXTRAKTION: ${file.name} (${(file.size/1024).toFixed(0)} KB) ═══`);

  if (onProgress) onProgress('converting', file.name);

  // Convert file to images
  let images;
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    images = await pdfToImages(file);
  } else {
    images = await imageToBase64(file);
  }

  log('angebot', `  ${images.length} Seiten konvertiert`, { file: file.name });

  if (onProgress) onProgress('reading', file.name);

  // For large PDFs (>10 pages), split into batches to avoid API limits
  let raw;
  if (images.length > 10) {
    log('angebot', `  Großes PDF → Batch-Verarbeitung (${Math.ceil(images.length/8)} Batches)`);
    raw = await extractLargePdf(images, onProgress, file.name);
  } else {
    raw = await callClaudeVision(images);
  }

  log('angebot', `  Claude-Antwort erhalten`, {
    lieferant: raw?.lieferant,
    positionen: raw?.positionen?.length || 0,
    fracht: raw?.fracht,
  });

  if (onProgress) onProgress('processing', file.name);

  // Calculate effective prices
  const processed = processExtractedData(raw, file.name);

  log('angebot', `  ✓ ${processed.lieferant}: ${processed.positionen.length} Preise extrahiert`, {
    typ: processed.typ,
    warnings: processed.warnings?.length || 0,
    fracht_eur: processed.fracht?.pauschal_eur || 0,
  });
  if (processed.warnings?.length > 0) {
    for (const w of processed.warnings) {
      log('angebot', `  ⚠ ${w}`, null, 'WARN');
    }
  }

  return processed;
}


/**
 * Handle large PDFs by splitting into page batches and merging results
 */
async function extractLargePdf(images, onProgress, fileName) {
  const BATCH_SIZE = 8;
  const batches = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    batches.push(images.slice(i, i + BATCH_SIZE));
  }

  let merged = null;

  for (let b = 0; b < batches.length; b++) {
    if (onProgress) onProgress('reading', `${fileName} (Teil ${b + 1}/${batches.length})`);

    const batchResult = await callClaudeVision(batches[b]);

    if (!merged) {
      merged = batchResult;
    } else {
      // Merge positions from subsequent batches
      if (batchResult.positionen) {
        merged.positionen = [...(merged.positionen || []), ...batchResult.positionen];
      }
      // Merge fracht
      if (batchResult.fracht) {
        if (Array.isArray(batchResult.fracht) && Array.isArray(merged.fracht)) {
          merged.fracht = [...merged.fracht, ...batchResult.fracht];
        } else if (Array.isArray(batchResult.fracht)) {
          merged.fracht = batchResult.fracht;
        }
      }
      // Merge handschriftliche_notizen
      if (batchResult.handschriftliche_notizen?.length) {
        merged.handschriftliche_notizen = [
          ...(merged.handschriftliche_notizen || []),
          ...batchResult.handschriftliche_notizen,
        ];
      }
      // Take energiekostenzuschlag from any batch that has it
      if (batchResult.energiekostenzuschlag_pct && !merged.energiekostenzuschlag_pct) {
        merged.energiekostenzuschlag_pct = batchResult.energiekostenzuschlag_pct;
      }
    }
  }

  return merged;
}


/**
 * Process raw extraction: calculate effective prices, validate
 */
function processExtractedData(raw, fileName) {
  // Normalize fracht: support both old single-object and new array format
  let frachtData;
  if (Array.isArray(raw.fracht)) {
    // New format: array of fracht entries → sum pauschal, keep per_t
    const totalPauschal = raw.fracht.reduce((sum, f) => sum + (f.betrag_eur || f.pauschal_eur || 0), 0);
    const freiAb = raw.fracht.find(f => f.frei_ab_eur)?.frei_ab_eur || null;
    const perT = raw.fracht.find(f => f.per_t_eur)?.per_t_eur || 0;
    frachtData = { pauschal_eur: totalPauschal, frei_ab_eur: freiAb, per_t_eur: perT, details: raw.fracht };
  } else {
    frachtData = raw.fracht || { pauschal_eur: 0 };
  }

  const result = {
    lieferant: raw.lieferant || 'Unbekannt',
    datum: raw.datum || new Date().toISOString().slice(0, 10),
    angebots_nr: raw.angebots_nr || null,
    typ: raw.typ || 'material_liste',
    gueltig_bis: raw.gueltig_bis || null,
    datei: fileName,
    fracht: frachtData,
    energiekostenzuschlag_pct: raw.energiekostenzuschlag_pct || null,
    montage_pauschal_eur: raw.montage_pauschal_eur || null,
    handschriftliche_notizen: raw.handschriftliche_notizen || [],
    positionen: [],
    warnings: [],
  };

  // Global energy surcharge (applied to all positions)
  const globalEnergiePct = raw.energiekostenzuschlag_pct || 0;

  for (const pos of (raw.positionen || [])) {
    // Skip unavailable items
    if (pos.verfuegbar === false) {
      result.warnings.push(`${pos.bezeichnung}: nicht lieferbar — übersprungen`);
      continue;
    }

    // Validate price
    if (!pos.preis || pos.preis <= 0) {
      result.warnings.push(`${pos.bezeichnung}: Preis ungültig (${pos.preis})`);
      continue;
    }

    // Calculate effective price (base + surcharges)
    let effektiv = pos.preis;
    const zuschlaege_detail = [];

    for (const z of (pos.zuschlaege || [])) {
      if (z.wert && z.einheit) {
        if (z.einheit.includes('€/') || z.einheit.includes('eur/')) {
          effektiv += z.wert;
          zuschlaege_detail.push(`${z.typ}: +${z.wert} ${z.einheit}`);
        } else if (z.einheit === '%') {
          effektiv *= (1 + z.wert / 100);
          zuschlaege_detail.push(`${z.typ}: +${z.wert}%`);
        }
      }
    }

    // Apply global energy surcharge
    if (globalEnergiePct > 0) {
      effektiv *= (1 + globalEnergiePct / 100);
      zuschlaege_detail.push(`Energiekosten: +${globalEnergiePct}%`);
    }

    result.positionen.push({
      id: `${result.lieferant}_${result.positionen.length}`,
      pos_nr: pos.pos_nr || null,
      bezeichnung: pos.bezeichnung || '',
      preis_basis: pos.preis,
      preis_effektiv: Math.round(effektiv * 100) / 100,
      einheit: pos.einheit || '',
      ist_alternative: pos.ist_alternative || false,
      zuschlaege: pos.zuschlaege || [],
      zuschlaege_text: zuschlaege_detail.join(', '),
      mindermenge: pos.mindermenge || null,
      notizen: pos.notizen || '',
      ust_satz: pos.ust_satz || 19,
    });
  }

  return result;
}


// ─── ANGEBOT STORAGE ──────────────────────────────────────────────

const ANGEBOT_STORAGE_PREFIX = 'kalku_angebote_';

/**
 * Save extracted Angebot to project storage
 */
export function saveAngebot(projectId, angebot) {
  const key = ANGEBOT_STORAGE_PREFIX + projectId;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');

  // Check for duplicate supplier
  const existingIdx = existing.findIndex(a =>
    a.lieferant.toLowerCase() === angebot.lieferant.toLowerCase()
  );

  if (existingIdx >= 0) {
    existing[existingIdx] = { ...angebot, id: existing[existingIdx].id };
  } else {
    angebot.id = `ang_${Date.now()}`;
    existing.push(angebot);
  }

  localStorage.setItem(key, JSON.stringify(existing));
  return existing;
}

/**
 * Get all Angebote for a project
 */
export function getAngebote(projectId) {
  const key = ANGEBOT_STORAGE_PREFIX + projectId;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

/**
 * Delete an Angebot from project
 */
export function deleteAngebot(projectId, angebotId) {
  const key = ANGEBOT_STORAGE_PREFIX + projectId;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  const filtered = existing.filter(a => a.id !== angebotId);
  localStorage.setItem(key, JSON.stringify(filtered));
  return filtered;
}
