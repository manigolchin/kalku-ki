/**
 * AI ASSISTANT — Claude API fallback for positions the regex engine can't handle
 *
 * Architecture: "AI reads text, Code calculates math" (Cosuno pattern)
 *
 * Called ONLY when:
 * 1. classifier.js returns unknown/low confidence → AI classifies
 * 2. No price from Angebote or Sirados → AI estimates market price
 * 3. Langtext has complex descriptions regex can't parse → AI extracts
 *
 * Returns STRUCTURED DATA that the deterministic calculator uses.
 * AI never calculates EP/GP — that's always code.
 */

import { getApiKey, hasApiKey } from './angebotExtractor.js';
import { GALABAU } from './regelwerk.js';

// ─── BUILD AVAILABLE LEISTUNGEN LIST FOR AI ──────────────────────
function getLeistungenList() {
  const list = [];
  for (const [catKey, category] of Object.entries(GALABAU)) {
    for (const [key, leistung] of Object.entries(category.leistungen)) {
      list.push(`${catKey}.${key}: ${leistung.label} (Y=${leistung.Y || leistung.Y_min || leistung.Y_per_tag || '?'}, Z=${leistung.Z}, Einheit=${leistung.einheit})`);
    }
  }
  return list.join('\n');
}


// ─── AI CLASSIFICATION ───────────────────────────────────────────

const CLASSIFY_PROMPT = `Du bist ein erfahrener GaLaBau-Kalkulator. Analysiere diese LV-Position und klassifiziere sie.

Verfügbare Leistungen im System:
{LEISTUNGEN}

Position:
- Kurztext: {KURZTEXT}
- Langtext: {LANGTEXT}
- Einheit: {EINHEIT}
- Menge: {MENGE}

Antworte NUR mit validem JSON (kein Markdown, kein Text):
{
  "category": "baustelleneinrichtung|erdarbeiten|schuettgueter|pflaster_bord|beton_abbruch|schwere_bauteile|pflanzen|pflege",
  "leistung": "exakte leistung_key aus der Liste oben",
  "modus": "normal|nu|vorhalten|zulage",
  "materialien_benoetigt": [
    { "bezeichnung": "exakte Materialbezeichnung", "einheit": "t|m²|m³|lfm|St", "ist_hauptmaterial": true }
  ],
  "dimensionen": {
    "dicke_cm": null,
    "hoehe_cm": null,
    "breite_cm": null,
    "schichtdicke_cm": null,
    "bodenklasse": null
  },
  "arbeitszeit_schaetzung_min": null,
  "geraete_eur_h": null,
  "ist_reine_arbeit": false,
  "hinweise": ["wichtige Erkenntnisse aus dem Langtext"],
  "confidence": 0.85
}`;


/**
 * Use Claude AI to classify an unknown position
 * @param {Object} position - { short_text, long_text, unit, quantity }
 * @returns {Object|null} Structured classification result
 */
export async function classifyWithAI(position) {
  if (!hasApiKey()) return null;

  const prompt = CLASSIFY_PROMPT
    .replace('{LEISTUNGEN}', getLeistungenList())
    .replace('{KURZTEXT}', position.short_text || '')
    .replace('{LANGTEXT}', position.long_text || '')
    .replace('{EINHEIT}', position.unit || '')
    .replace('{MENGE}', String(position.quantity || 0));

  try {
    const result = await callClaude(prompt);
    if (!result) return null;

    // Validate the AI returned a known leistung
    const category = GALABAU[result.category];
    if (category && category.leistungen[result.leistung]) {
      return {
        ...result,
        source: 'ai_classification',
        validated: true,
      };
    }

    // AI returned unknown leistung — still use materialien + hinweise
    return {
      ...result,
      source: 'ai_classification',
      validated: false,
    };
  } catch (err) {
    console.error('AI classification error:', err);
    return null;
  }
}


// ─── AI LANGTEXT ANALYSIS ────────────────────────────────────────

const LANGTEXT_PROMPT = `Du bist ein erfahrener GaLaBau-Kalkulator. Analysiere den Langtext dieser LV-Position und extrahiere ALLE relevanten Details für die Kalkulation.

Kurztext: {KURZTEXT}
Langtext: {LANGTEXT}
Einheit: {EINHEIT}

WICHTIG: Finde heraus:
1. Welche MATERIALIEN werden ALLE benötigt? (Hauptmaterial + Nebenmaterial wie Beton, Splitt, Sand)
2. Gibt es spezielle Anforderungen? (Sichtbeton, DIN-Normen, Sonderform, Handarbeit)
3. Welche MASSE/DIMENSIONEN werden genannt? (Dicke, Höhe, Breite, DN, Schichtdicke)
4. Gibt es Zulagen-Referenzen? ("wie Pos. X", "Zulage zu")
5. Sind Nebenmaterialien in separaten Positionen? ("Bettung siehe Pos. ...")

Antworte NUR mit validem JSON:
{
  "materialien": [
    {
      "bezeichnung": "exakte Bezeichnung",
      "typ": "hauptmaterial|nebenmaterial|verbrauchsmaterial",
      "einheit": "t|m²|m³|lfm|St|kg",
      "menge_pro_einheit": null,
      "hinweis": "z.B. 0.05 m³/lfm Rückenbeton"
    }
  ],
  "dimensionen": {
    "dicke_cm": null,
    "hoehe_cm": null,
    "breite_cm": null,
    "tiefe_m": null,
    "schichtdicke_cm": null,
    "dn": null,
    "bordstein_typ": null,
    "stammumfang_von": null,
    "stammumfang_bis": null,
    "pflaster_dicke_cm": null,
    "beton_klasse": null,
    "bodenklasse_von": null,
    "bodenklasse_bis": null
  },
  "modifiers": {
    "inkl_fundament": false,
    "inkl_rueckenstuetze": false,
    "inkl_bettung": false,
    "sichtbeton": false,
    "handarbeit": false,
    "sonderform": false,
    "wechselfeucht": false,
    "verkehrslast": false,
    "anpassen": false,
    "din1176": false
  },
  "hinweise": ["wichtige Erkenntnisse"],
  "separate_positionen_referenz": ["Pos. 4.1.2 enthält Bettung"]
}`;


/**
 * Use AI to deeply analyze a position's Langtext for materials + dimensions
 * Called when regex scanner might miss complex descriptions
 * @param {Object} position - { short_text, long_text, unit }
 * @returns {Object|null} Extracted materials, dimensions, modifiers
 */
export async function analyzeLangtextWithAI(position) {
  if (!hasApiKey()) return null;
  if (!position.long_text || position.long_text.trim().length < 20) return null;

  const prompt = LANGTEXT_PROMPT
    .replace('{KURZTEXT}', position.short_text || '')
    .replace('{LANGTEXT}', position.long_text || '')
    .replace('{EINHEIT}', position.unit || '');

  try {
    return await callClaude(prompt);
  } catch (err) {
    console.error('AI langtext analysis error:', err);
    return null;
  }
}


// ─── AI PRICE ESTIMATION ─────────────────────────────────────────

const PRICE_PROMPT = `Du bist ein erfahrener Baukalkulator in Deutschland (Region Saarland).
Schätze den aktuellen Netto-Marktpreis für dieses Baumaterial/diese Leistung.

Material/Leistung: {MATERIAL}
Einheit: {EINHEIT}
Kontext: {KONTEXT}

WICHTIG:
- NUR Netto-Preise (ohne MwSt)
- Aktuelle Marktpreise 2024-2026
- Bei Schüttgütern: Preis frei Baustelle (inkl. Transport)
- Bei Pflanzen: Baumschulpreise
- Gib eine realistische Spanne an

Antworte NUR mit validem JSON:
{
  "preis_netto": 0.00,
  "einheit": "...",
  "spanne_von": 0.00,
  "spanne_bis": 0.00,
  "vertrauen": "hoch|mittel|niedrig",
  "quelle": "Marktkenntnis",
  "hinweis": "kurze Begründung"
}`;


/**
 * Use AI to estimate a market price when no Angebot/Sirados available
 * @param {string} materialText - What to price
 * @param {string} einheit - Target unit
 * @param {string} kontext - Additional context (position text)
 * @returns {Object|null} Price estimate
 */
export async function findPriceWithAI(materialText, einheit, kontext = '') {
  if (!hasApiKey()) return null;

  const prompt = PRICE_PROMPT
    .replace('{MATERIAL}', materialText)
    .replace('{EINHEIT}', einheit || '')
    .replace('{KONTEXT}', kontext);

  try {
    const result = await callClaude(prompt);
    if (!result || !result.preis_netto) return null;

    return {
      preis: result.preis_netto,
      einheit: result.einheit || einheit,
      spanne: { von: result.spanne_von, bis: result.spanne_bis },
      vertrauen: result.vertrauen || 'niedrig',
      quelle: `KI-Schätzung: ${result.hinweis || result.quelle || 'Marktkenntnis'}`,
      source: 'ai_price',
    };
  } catch (err) {
    console.error('AI price estimation error:', err);
    return null;
  }
}


// ─── CLAUDE API CALL ─────────────────────────────────────────────

async function callClaude(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

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
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API: ${response.status} — ${err}`);
  }

  const data = await response.json();

  // Check for API error response
  if (data.error) {
    throw new Error(`Claude API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const text = data.content?.[0]?.text || '';
  if (!text.trim()) {
    throw new Error('Claude API returned empty response');
  }

  // Parse JSON from response (handle markdown wrapping)
  const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`KI-Antwort konnte nicht geparst werden: ${jsonStr.slice(0, 200)}`);
  }
}


// ─── BATCH PROCESSOR ─────────────────────────────────────────────

/**
 * Process multiple positions that need AI help
 * Batches to avoid overwhelming the API
 * @param {Array} positions - Positions needing AI analysis
 * @param {string} mode - 'classify' | 'langtext' | 'price'
 * @param {Function} onProgress - Progress callback
 * @returns {Map} oz → AI result
 */
export async function batchAIProcess(positions, mode, onProgress) {
  const results = new Map();
  let processed = 0;

  for (const pos of positions) {
    try {
      let result = null;

      switch (mode) {
        case 'classify':
          result = await classifyWithAI(pos);
          break;
        case 'langtext':
          result = await analyzeLangtextWithAI(pos);
          break;
        case 'price':
          result = await findPriceWithAI(
            pos.short_text,
            pos.unit,
            pos.long_text || ''
          );
          break;
      }

      if (result) {
        results.set(pos.oz, result);
      }
    } catch (err) {
      console.error(`AI ${mode} error for ${pos.oz}:`, err);
    }

    processed++;
    if (onProgress) onProgress(processed, positions.length);

    // Small delay to avoid rate limiting
    if (processed < positions.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}
