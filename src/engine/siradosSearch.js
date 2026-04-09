/**
 * SIRADOS SEARCH — Backup price lookup from Sirados database
 *
 * Loads the Sirados positions JSON and provides fuzzy text search.
 * Used as fallback in the price waterfall (after Angebote, PDB, KB).
 *
 * Prices in Sirados are stored in CENTS. Convert to EUR: value / 100.
 */

let siradosData = null;
let searchIndex = null;

// ─── LOAD SIRADOS DATA ───────────────────────────────────────────
/**
 * Load Sirados positions from JSON (called once at app startup)
 * @param {Array} data - Parsed JSON array of Sirados positions
 */
export function loadSiradosData(data) {
  if (!Array.isArray(data)) {
    console.warn('Sirados: Invalid data format');
    return;
  }
  siradosData = data;
  buildSearchIndex();
  console.log(`Sirados: ${data.length} Positionen geladen`);
}

/**
 * Build a simple text search index
 */
function buildSearchIndex() {
  if (!siradosData) return;
  searchIndex = siradosData.map((pos, idx) => ({
    idx,
    searchText: normalize(pos.text || '') + ' ' + normalize(pos.kurztext || ''),
    nr: pos.nr,
    gewerk: pos.gewerk,
  }));
}

// ─── SEARCH ──────────────────────────────────────────────────────

/**
 * Search Sirados for positions matching a query
 * @param {string} query - Search text (from LV position Kurztext/Langtext)
 * @param {Object} options - { maxResults, gewerk, einheit }
 * @returns {Array} Matching positions with prices in EUR
 */
export function searchSirados(query, options = {}) {
  if (!searchIndex || !siradosData) return [];

  const { maxResults = 5, gewerk = null, einheit = null } = options;
  const queryNorm = normalize(query);
  const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);

  if (queryWords.length === 0) return [];

  const scored = [];

  for (const entry of searchIndex) {
    // Filter by Gewerk if specified
    if (gewerk && entry.gewerk !== gewerk) continue;

    // Score: count matching words
    let score = 0;
    let matchedWords = 0;
    for (const word of queryWords) {
      if (entry.searchText.includes(word)) {
        matchedWords++;
        score += word.length; // longer words = better match
      }
    }

    if (matchedWords === 0) continue;

    // Bonus for matching more query words
    const coverage = matchedWords / queryWords.length;
    score *= coverage;

    // Filter by unit if specified
    const pos = siradosData[entry.idx];
    if (einheit && pos.mengeneinheit) {
      const eNorm = normalizeUnit(einheit);
      const sNorm = normalizeUnit(pos.mengeneinheit);
      if (eNorm === sNorm) score *= 1.5; // bonus for same unit
    }

    scored.push({ idx: entry.idx, score, coverage });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top results with EUR conversion
  return scored.slice(0, maxResults).map(s => {
    const pos = siradosData[s.idx];
    return {
      nr: pos.nr,
      text: pos.text || pos.kurztext,
      kurztext: pos.kurztext,
      einheit: pos.mengeneinheit,
      // Prices in EUR (stored as cents in JSON)
      ep: (pos.ep || 0) / 100,
      von: (pos.von || 0) / 100,
      mittel: (pos.mittel || 0) / 100,
      bis: (pos.bis || 0) / 100,
      lohn: (pos.lohn || 0) / 100,
      material: (pos.material || 0) / 100,
      geraet: (pos.gerät || 0) / 100,
      zeit_h: pos.zeit || 0,
      gewerk: pos.gewerk,
      untergruppe: pos.untergruppe,
      // Search metadata
      score: Math.round(s.score),
      coverage: Math.round(s.coverage * 100),
      confidence: s.coverage > 0.7 ? 'HIGH' : s.coverage > 0.4 ? 'MEDIUM' : 'LOW',
    };
  });
}

/**
 * Find the best Sirados match for a classified position
 * @param {string} shortText - LV Kurztext
 * @param {string} longText - LV Langtext
 * @param {string} einheit - LV Einheit
 * @returns {Object|null} Best match with prices, or null
 */
export function findBestSiradosMatch(shortText, longText, einheit) {
  // Try short text first (usually more specific)
  let results = searchSirados(shortText, { maxResults: 3, einheit });

  // If no good match, try with long text
  if (results.length === 0 || results[0].coverage < 0.4) {
    const longResults = searchSirados(longText || '', { maxResults: 3, einheit });
    results = [...results, ...longResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  if (results.length === 0) return null;

  const best = results[0];
  return {
    ...best,
    preis_range: `${best.von.toFixed(2)} – ${best.bis.toFixed(2)} €/${best.einheit || '?'}`,
    verwendbar: best.confidence !== 'LOW',
  };
}

/**
 * Check if a calculated EP is plausible against Sirados
 * @param {string} shortText - Position text for matching
 * @param {number} calculatedEP - Our calculated EP
 * @param {string} einheit - Unit
 * @returns {{ status, message, siradosRange }}
 */
export function checkAgainstSirados(shortText, calculatedEP, einheit) {
  const match = findBestSiradosMatch(shortText, '', einheit);

  if (!match || !match.verwendbar) {
    return { status: 'no_data', message: 'Kein Sirados-Vergleich verfügbar' };
  }

  if (calculatedEP >= match.von && calculatedEP <= match.bis) {
    return {
      status: 'plausibel',
      message: `EP ${calculatedEP.toFixed(2)} € liegt im Sirados-Bereich (${match.preis_range})`,
      siradosRange: match.preis_range,
    };
  }

  const deviation = match.mittel > 0
    ? Math.abs(calculatedEP - match.mittel) / match.mittel * 100
    : 0;

  if (deviation > 50) {
    return {
      status: 'kritisch',
      message: `EP ${calculatedEP.toFixed(2)} € weicht ${deviation.toFixed(0)}% vom Sirados-Mittel ab (${match.preis_range})`,
      siradosRange: match.preis_range,
    };
  }

  return {
    status: 'pruefen',
    message: `EP ${calculatedEP.toFixed(2)} € weicht ${deviation.toFixed(0)}% ab (Sirados: ${match.preis_range})`,
    siradosRange: match.preis_range,
  };
}

/**
 * Check if Sirados data is loaded
 */
export function isSiradosLoaded() {
  return siradosData !== null && siradosData.length > 0;
}

/**
 * Get Sirados stats
 */
export function getSiradosStats() {
  if (!siradosData) return { loaded: false, count: 0 };
  return {
    loaded: true,
    count: siradosData.length,
    gewerke: [...new Set(siradosData.map(p => p.gewerk))].length,
  };
}


// ─── HELPERS ──────────────────────────────────────────────────────

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s/²³.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(unit) {
  return (unit || '').toLowerCase()
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/stk|stck|stück/g, 'st')
    .replace(/lfdm|lfd\.?\s*m/g, 'lfm')
    .trim();
}
