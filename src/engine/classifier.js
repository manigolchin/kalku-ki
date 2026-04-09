/**
 * POSITION CLASSIFIER — Matches LV position text to Regelwerk categories
 *
 * Pattern-based classification (deterministic, no AI needed for common positions).
 * Returns category + leistung key + confidence score.
 */

// ─── CLASSIFICATION PATTERNS ──────────────────────────────────────
// Each pattern: { id, category, leistung, triggers (all/any/none/regex), priority }
const PATTERNS = [

  // ═══ NU TRIGGERS (highest priority — force NU mode) ═══
  {
    id: 'nu_fallschutz_belag',
    category: null, leistung: null, modus: 'nu',
    triggers: {
      any: ['fallschutzbelag', 'fallschutz epdm', 'fallschutz kautschuk', 'fallschutz gummigranulat'],
      none: ['rasengitter', 'ausschneiden', 'zulage'],
    },
    priority: 100,
  },
  {
    id: 'nu_markierung',
    category: null, leistung: null, modus: 'nu',
    triggers: {
      any: ['fahrbahnmarkierung', 'markierung thermoplast', 'markierung kaltplast'],
      none: [],
    },
    priority: 100,
  },
  {
    id: 'nu_tuev',
    category: null, leistung: null, modus: 'nu',
    triggers: {
      any: ['tüv', 'tuev', 'tüv-prüfung', 'tuev-pruefung', 'tüv-abnahme', 'sachverständig', 'sachverstaendig', 'inspektion din 1176', 'prüfung spielplatz', 'spielplatzprüfung'],
      none: [],
    },
    priority: 100,
  },
  // Asphalt CONSTRUCTION is always NU (GaLaBau subcontracts asphalt paving)
  // Note: Asphalt DEMOLITION and CUTTING are NOT NU — those are done by the company
  {
    id: 'nu_asphalt_einbau',
    category: null, leistung: null, modus: 'nu',
    triggers: {
      any: ['asphaltdeckschicht', 'asphalttragschicht', 'asphaltbinderschicht',
            'schwarzdecke herstell', 'asphalt herstell', 'asphalt einbau',
            'asphaltfläche herstell', 'asphaltbelag herstell', 'asphaltier',
            'walzasphalt', 'gussasphalt', 'asphaltbeton'],
      none: ['aufnehmen', 'abbruch', 'abbrechen', 'rückbau', 'schneid', 'trenn',
             'fräsen', 'entsorgen'],
    },
    priority: 100,
  },

  // ═══ ZULAGEPOSITIONEN (detect price difference positions) ═══
  {
    id: 'zulage_generic',
    category: null, leistung: null, modus: 'zulage',
    triggers: {
      regex_any: [/\bzulage\b/, /\bwie\s+vor\s*,?\s*jedoch\b/, /\babweichend\s+von\b/,
                  /\bmehr[-\s]?kosten\b/, /\bminder[-\s]?kosten\b/, /\baufpreis\b/],
      none: [],
    },
    priority: 90, // high — must override category matching
  },

  // ═══ VORHALTEN (detect by unit, high priority) ═══
  {
    id: 'vorhalten_generic',
    category: 'baustelleneinrichtung', leistung: null, modus: 'vorhalten',
    triggers: {
      any: ['vorhalten', 'vorhaltung', 'vorhalt'],
      none: ['herstell', 'aufstell', 'räumen', 'raeumen', 'rückbau'],
    },
    einheit_any: ['StWo', 'mWo', 'StMt', 'StTag', 'stwo', 'mwo', 'stmt', 'sttag'],
    priority: 95,
  },

  // ═══ §1 BAUSTELLENEINRICHTUNG ═══
  {
    id: 'be_einrichten',
    category: 'baustelleneinrichtung', leistung: 'be_einrichten_galabau',
    triggers: {
      any: ['baustelleneinrichtung', 'baustelle einrichten', 'be einrichten', 'baustelleneinr'],
      none: ['räumen', 'raeumen', 'vorhalt'],
    },
    priority: 80,
  },
  {
    id: 'be_raeumen',
    category: 'baustelleneinrichtung', leistung: 'be_raeumen',
    triggers: {
      any: ['baustelle räumen', 'baustellenräumung', 'be räumen', 'baustelle raeumen'],
      none: ['vorhalt'],
    },
    priority: 80,
  },
  {
    id: 'be_vorhalten',
    category: 'baustelleneinrichtung', leistung: 'be_vorhalten',
    triggers: {
      any: ['baustelleneinr. vorhalt', 'baustelleneinrichtung vorhalt', 'be vorhalt'],
      none: [],
    },
    priority: 85,
  },
  {
    id: 'dixi_aufstellen',
    category: 'baustelleneinrichtung', leistung: 'dixi_aufstellen',
    triggers: {
      any: ['dixi', 'mobiltoilette', 'mobile toilette', 'miettoilette'],
      none: ['vorhalt'],
    },
    priority: 80,
  },
  {
    id: 'dixi_vorhalten',
    category: 'baustelleneinrichtung', leistung: 'dixi_vorhalten',
    triggers: {
      any: ['dixi', 'mobiltoilette'],
      all: ['vorhalt'],
    },
    priority: 85,
  },
  {
    id: 'wc_aufstellen',
    category: 'baustelleneinrichtung', leistung: 'wc_aufstellen',
    triggers: {
      any: ['wc-container', 'wc container', 'sanitärcontainer'],
      none: ['vorhalt'],
    },
    priority: 80,
  },
  {
    id: 'wc_vorhalten',
    category: 'baustelleneinrichtung', leistung: 'wc_vorhalten',
    triggers: {
      any: ['wc-container', 'wc container', 'sanitärcontainer'],
      all: ['vorhalt'],
    },
    priority: 85,
  },
  {
    id: 'tor_aufstellen',
    category: 'baustelleneinrichtung', leistung: 'tor_aufstellen',
    triggers: {
      all: ['tor'],
      any: ['abschließ', 'metallgitter', 'aufstell', 'bauzauntor'],
      none: ['vorhalt', 'drehflügel', 'gartentor', 'einfahrtstor'],
    },
    priority: 75,
  },
  {
    id: 'schutzzaun_herstellen',
    category: 'baustelleneinrichtung', leistung: 'schutzzaun_herstellen',
    triggers: {
      any: ['schutzzaun', 'bauzaun'],
      none: ['vorhalt', 'tor'],
      regex_none: [/\bversetzen\b/, /umsetzen/],
    },
    priority: 70,
  },
  {
    id: 'schutzzaun_versetzen',
    category: 'baustelleneinrichtung', leistung: 'schutzzaun_versetzen',
    triggers: {
      any: ['schutzzaun', 'bauzaun'],
      regex_any: [/\b(versetzen|umsetzen)\b/],
      none: ['vorhalt', 'tor'],
    },
    priority: 72,
  },

  // ═══ §2 ERDARBEITEN ═══
  {
    id: 'oberboden_abtragen',
    category: 'erdarbeiten', leistung: 'oberboden_abtragen',
    triggers: {
      any: ['oberboden', 'mutterboden'],
      regex_any: [/abtrag|abschieb|abräum/],
      none: ['andecken', 'auftrag', 'liefern', 'einbau'],
    },
    priority: 60,
  },
  {
    id: 'aushub_grossmaschine',
    category: 'erdarbeiten', leistung: 'aushub_grossmaschine',
    triggers: {
      any: ['aushub', 'bodenaushub', 'baugrube', 'boden lösen', 'erdaushub', 'boden laden'],
      none: ['hand', 'minibagger', 'einbau', 'verfüll', 'planieren', 'verdicht'],
    },
    priority: 55,
  },
  {
    id: 'aushub_handarbeit',
    category: 'erdarbeiten', leistung: 'aushub_handarbeit',
    triggers: {
      any: ['handarbeit', 'handaushub', 'hand lösen'],
      none: ['maschine', 'bagger'],
    },
    priority: 58,
  },
  {
    id: 'aushub_minibagger',
    category: 'erdarbeiten', leistung: 'aushub_minibagger',
    triggers: {
      any: ['minibagger', 'kleinbagger', 'kompaktbagger'],
      regex_any: [/aushub|lösen|graben/],
      none: ['einbau', 'verfüll'],
    },
    priority: 58,
  },
  {
    id: 'einbau_verdichten',
    category: 'erdarbeiten', leistung: 'einbau_grossmaschine',
    triggers: {
      any: ['einbau', 'verfüllung', 'verfüllen', 'boden einbauen', 'hinterfüllen', 'hinterfüllung'],
      regex_any: [/verdicht/],
      none: ['schotter', 'kies', 'sand liefern', 'pflaster', 'schüttgut', 'frostschutz', 'sts', 'tragschicht'],
    },
    priority: 50,
  },
  {
    id: 'transport_erdmassen',
    category: 'erdarbeiten', leistung: 'transport_innerhalb',
    triggers: {
      any: ['transport', 'fördern', 'umlagern'],
      regex_any: [/erdmass|boden|aushub/],
      none: ['entsorgen', 'deponie', 'abfuhr'],
    },
    priority: 45,
  },
  {
    id: 'planieren',
    category: 'erdarbeiten', leistung: 'planieren',
    triggers: {
      all: ['planum'],
      none: ['schotter', 'kies', 'sts'],
    },
    priority: 55,
  },

  // ═══ §3 SCHÜTTGÜTER ═══
  {
    id: 'schuettgut_einbau',
    category: 'schuettgueter', leistung: 'einbau_grossflaechig', // adjusted to kleinmenge at calc time if <200m²
    triggers: {
      any: ['schotter', 'kies', 'splitt', 'sand', 'frostschutz', 'sts', 'schottertragschicht',
            'tragschicht', 'sauberkeitsschicht', 'planie', 'rc-material', 'mineralgemisch',
            'mineralbeton', 'kiesgemisch'],
      regex_any: [/schüttgut|kiestragschicht|frostschutzschicht/],
      none: ['pflaster', 'bord', 'beton c', 'fugenmaterial', 'bettung pflaster'],
    },
    priority: 40,
  },

  // ═══ §4 PFLASTER & BORD ═══
  {
    id: 'pflaster_verlegen',
    category: 'pflaster_bord', leistung: 'pflaster_standard',
    triggers: {
      any: ['pflasterdecke', 'pflaster verlegen', 'betonpflaster', 'verbundpflaster',
            'betonsteinpflaster', 'kleinpflaster', 'pflasterbelag', 'pflasterfläche'],
      none: ['anpassen', 'rückbau', 'aufnehmen', 'schneiden', 'bord', 'rinne'],
    },
    priority: 60,
  },
  {
    id: 'pflaster_anpassen',
    category: 'pflaster_bord', leistung: 'schneiden_pflaster_beton',
    triggers: {
      any: ['anpassen'],
      regex_any: [/pflaster|belag|platte/],
      none: ['bord rückbau'],
    },
    priority: 65, // higher than regular pflaster
  },
  {
    id: 'bordstein_setzen',
    category: 'pflaster_bord', leistung: 'bordstein_setzen',
    triggers: {
      any: ['bord', 'bordstein', 'einfassung', 'randstein', 'betonbord'],
      none: ['rückbau', 'aufnehmen', 'anpassen', 'tiefbord', 'vorhalt'],
    },
    priority: 60,
  },
  {
    id: 'tiefbord_setzen',
    category: 'pflaster_bord', leistung: 'tiefbord_setzen',
    triggers: {
      any: ['tiefbord', 'tiefbordstein'],
      none: ['rückbau', 'aufnehmen', 'anpassen'],
    },
    priority: 62,
  },
  {
    id: 'schneiden_asphalt',
    category: 'pflaster_bord', leistung: 'schneiden_asphalt',
    triggers: {
      all: ['asphalt'],
      any: ['schneiden', 'schnitt', 'trennen', 'geradlinig'],
      none: ['aufnehmen', 'rückbau', 'abbruch', 'deckschicht', 'tragschicht', 'entsorgen'],
    },
    priority: 65,
  },

  // ═══ §5 BETON & ABBRUCH ═══
  {
    id: 'asphalt_aufnehmen',
    category: 'beton_abbruch', leistung: 'abbruch_asphalt',
    triggers: {
      all: ['asphalt'],
      any: ['aufnehmen', 'rückbau', 'abbruch', 'abbrechen', 'deckschicht aufnehmen', 'tragschicht aufnehmen'],
      none: ['schneiden', 'trennen', 'entsorgen nur', 'baustelleneinr'],
    },
    priority: 65,
  },
  {
    id: 'abbruch_beton',
    category: 'beton_abbruch', leistung: 'abbruch_beton',
    triggers: {
      any: ['abbruch beton', 'beton abbrechen', 'betonabbruch', 'fundament abbrechen'],
      none: ['stahlbeton', 'bewehr', 'asphalt'],
    },
    priority: 55,
  },
  {
    id: 'abbruch_stahlbeton',
    category: 'beton_abbruch', leistung: 'abbruch_stahlbeton',
    triggers: {
      any: ['stahlbeton', 'bewehrter beton'],
      regex_any: [/abbruch|abbrechen|rückbau/],
    },
    priority: 57,
  },
  {
    id: 'betonieren',
    category: 'beton_abbruch', leistung: 'betonieren_rein',
    triggers: {
      any: ['betonieren', 'beton einbau', 'beton herstell', 'ortbeton', 'fundament herstell',
            'betonfundament', 'streifenfundament', 'punktfundament'],
      none: ['abbruch', 'rückbau', 'aufnehmen', 'bord', 'pflaster'],
    },
    priority: 50,
  },

  // ═══ §5.6 SCHWERE BAUTEILE ═══
  {
    id: 'schacht_setzen',
    category: 'schwere_bauteile', leistung: 'schacht_setzen',
    triggers: {
      any: ['schacht', 'kontrollschacht', 'revisionsschacht', 'sickerschacht'],
      regex_any: [/setzen|einbau|versetzen/],
      none: ['vorhalt', 'abdeckung nur'],
    },
    priority: 60,
  },
  {
    id: 'doppelstabmatte',
    category: 'schwere_bauteile', leistung: 'doppelstabmatte',
    triggers: {
      any: ['doppelstabmatte', 'doppelstabgitterzaun', 'stabgitterzaun'],
      none: ['vorhalt', 'pfosten'],
    },
    priority: 60,
  },
  {
    id: 'zaunpfosten',
    category: 'schwere_bauteile', leistung: 'zaunpfosten',
    triggers: {
      any: ['zaunpfosten', 'pfosten setzen', 'pfosten einbeton'],
      none: ['vorhalt'],
    },
    priority: 58,
  },
  {
    id: 'drehfluegeltuer',
    category: 'schwere_bauteile', leistung: 'drehfluegeltuer',
    triggers: {
      any: ['drehflügeltür', 'drehflügeltor', 'gartentor', 'einfahrtstor', 'metalltor'],
      none: ['vorhalt', 'bauzaun'],
    },
    priority: 60,
  },
  {
    id: 'rinne_beton',
    category: 'schwere_bauteile', leistung: 'rinne_im_beton',
    triggers: {
      any: ['entwässerungsrinne', 'ablaufrinne', 'kastenrinne'],
      regex_any: [/rinne.*beton|rinne.*setzen|rinne.*verlegen/],
      none: ['vorhalt'],
    },
    priority: 55,
  },

  // ═══ §6 PFLANZEN ═══
  {
    id: 'baum_pflanzen',
    category: 'pflanzen', leistung: 'baum_pflanzen',
    triggers: {
      regex_any: [/\bhochstamm\b/, /\bstu\b/, /\bstu\./, /\bfraxinus\b/, /\bquercus\b/,
                  /\bacer\s+platanoides\b/, /\btilia\b/, /\bplatanus\b/, /\bprunus\b/],
      none: ['pflanzgrube', 'heckenpflanz', 'bord', 'einfassung', 'rohr', 'pvc', 'liefern'],
    },
    langtext_required_any: ['pflanzen', 'setzen'],
    priority: 55,
  },
  {
    id: 'baum_liefern',
    category: 'pflanzen', leistung: 'baum_liefern',
    triggers: {
      regex_any: [/\bhochstamm\b/, /\bstu\b/, /\bfraxinus\b/, /\bquercus\b/, /\bacer\b/, /\btilia\b/],
      any: ['liefern', 'lieferung'],
      none: ['pflanzen', 'setzen'],
    },
    priority: 57,
  },
  {
    id: 'hecke_pflanzen',
    category: 'pflanzen', leistung: 'hecke_pflanzen',
    triggers: {
      any: ['carpinus', 'ligustrum', 'thuja', 'heckenpflanz', 'hainbuche', 'liguster'],
      none: ['pflanzgrube'],
    },
    priority: 50,
  },
  {
    id: 'strauch_pflanzen',
    category: 'pflanzen', leistung: 'strauch_pflanzen',
    triggers: {
      any: ['strauch', 'zierstrauch', 'blütenstrauch', 'solitärstrauch'],
      none: ['pflanzgrube', 'hochstamm'],
    },
    priority: 48,
  },
  {
    id: 'rasen_einsaat',
    category: 'pflanzen', leistung: 'rasen_einsaat',
    triggers: {
      any: ['rasen', 'ansaat', 'einsaat', 'rasenfläche', 'rasensaat'],
      none: ['mähen', 'pflege', 'wässern', 'saatbett'],
    },
    priority: 45,
  },
  {
    id: 'rasen_saatbett',
    category: 'pflanzen', leistung: 'rasen_saatbett',
    triggers: {
      any: ['saatbett', 'feinplanum rasen'],
      none: [],
    },
    priority: 47,
  },
  {
    id: 'spielgeraet',
    category: 'pflanzen', leistung: 'spielgeraet_aufbauen',
    triggers: {
      any: ['spielgerät', 'klettergerät', 'schaukel', 'rutsche', 'wippe',
            'kletterturm', 'spielplatz aufbau', 'seilbahn', 'karussell'],
      none: ['prüfung', 'tüv', 'sachverständig', 'fallschutz'],
    },
    priority: 55,
  },

  // ═══ PFLEGE ═══
  {
    id: 'waessern',
    category: 'pflege', leistung: 'waessern_pflanzung',
    triggers: {
      any: ['wässern', 'bewässern', 'bewässerung', 'gießen'],
      none: [],
    },
    priority: 45,
  },
  {
    id: 'maehen',
    category: 'pflege', leistung: 'maehen',
    triggers: {
      any: ['mähen', 'rasenmahd', 'rasenschnitt'],
      none: [],
    },
    priority: 45,
  },
  {
    id: 'fertigstellungspflege',
    category: 'pflege', leistung: 'fertigstellungspflege',
    triggers: {
      any: ['fertigstellungspflege', 'entwicklungspflege', 'anwuchspflege'],
      none: [],
    },
    priority: 50,
  },
];


// ─── NORMALIZE TEXT ───────────────────────────────────────────────
function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s/.²³]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Also keep original lowercase for umlauts matching
function lowerClean(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}


// ─── MATCH TRIGGERS ───────────────────────────────────────────────
function matchesTriggers(text, longText, unit, triggers, langtext_required_any, einheit_any) {
  const combined = lowerClean(text + ' ' + (longText || ''));
  const normalized = normalize(text + ' ' + (longText || ''));
  const searchIn = combined + ' ' + normalized;

  // Check unit requirement
  if (einheit_any && einheit_any.length > 0) {
    const unitLower = (unit || '').toLowerCase();
    if (!einheit_any.some(u => u.toLowerCase() === unitLower)) return false;
  }

  // ALL keywords must be present
  if (triggers.all && triggers.all.length > 0) {
    if (!triggers.all.every(kw => searchIn.includes(kw.toLowerCase()))) return false;
  }

  // ANY keyword must match
  if (triggers.any && triggers.any.length > 0) {
    if (!triggers.any.some(kw => searchIn.includes(kw.toLowerCase()))) {
      // Check regex_any as fallback
      if (!triggers.regex_any || triggers.regex_any.length === 0) return false;
    }
  }

  // REGEX ANY
  if (triggers.regex_any && triggers.regex_any.length > 0) {
    const anyRegexMatch = triggers.regex_any.some(rx => {
      const re = rx instanceof RegExp ? rx : new RegExp(rx, 'i');
      return re.test(combined);
    });
    // If no any keywords matched, regex_any must match
    if (!triggers.any || triggers.any.length === 0 || !triggers.any.some(kw => searchIn.includes(kw.toLowerCase()))) {
      if (!anyRegexMatch) return false;
    }
  }

  // NONE keywords must be absent
  if (triggers.none && triggers.none.length > 0) {
    if (triggers.none.some(kw => searchIn.includes(kw.toLowerCase()))) return false;
  }

  // REGEX NONE
  if (triggers.regex_none && triggers.regex_none.length > 0) {
    if (triggers.regex_none.some(rx => {
      const re = rx instanceof RegExp ? rx : new RegExp(rx, 'i');
      return re.test(combined);
    })) return false;
  }

  // Langtext requirements
  if (langtext_required_any && langtext_required_any.length > 0) {
    const ltText = lowerClean(longText || '');
    if (!langtext_required_any.some(kw => ltText.includes(kw.toLowerCase()))) return false;
  }

  return true;
}


// ─── CLASSIFY POSITION ────────────────────────────────────────────
/**
 * Classify a single LV position
 * @param {string} text - Kurztext
 * @param {string} longText - Langtext
 * @param {string} unit - Einheit (m², m³, lfm, St, etc.)
 * @returns {{ id, category, leistung, modus, confidence, allMatches }}
 */
export function classifyPosition(text, longText, unit) {
  const matches = [];

  for (const pattern of PATTERNS) {
    if (matchesTriggers(text, longText, unit, pattern.triggers, pattern.langtext_required_any, pattern.einheit_any)) {
      matches.push({
        id: pattern.id,
        category: pattern.category,
        leistung: pattern.leistung,
        modus: pattern.modus || 'normal',
        priority: pattern.priority,
      });
    }
  }

  // Sort by priority descending
  matches.sort((a, b) => b.priority - a.priority);

  if (matches.length === 0) {
    return {
      id: 'unknown',
      category: null,
      leistung: null,
      modus: 'unknown',
      confidence: 0,
      allMatches: [],
    };
  }

  const best = matches[0];
  // Confidence based on: single match = high, multiple with same category = medium
  const confidence = matches.length === 1 ? 0.95
    : matches[0].priority - (matches[1]?.priority || 0) > 10 ? 0.90
    : 0.70;

  const result = {
    ...best,
    confidence,
    allMatches: matches,
  };

  // Extract base position reference for Zulagen
  if (best.modus === 'zulage') {
    const combined = lowerClean(text + ' ' + (longText || ''));
    const ozMatch = combined.match(/(?:zu\s+pos\.?\s*|position\s+|pos\.\s*)(\d+[.\d]*)/i);
    if (ozMatch) {
      result.zulage_basis_oz = ozMatch[1];
    }
  }

  return result;
}


/**
 * Check if position is a Vorhalte-Position based on unit
 */
export function isVorhaltePosition(unit) {
  const u = (unit || '').toLowerCase();
  return ['stwo', 'mwo', 'stmt', 'sttag'].includes(u);
}

/**
 * Check if position text matches NU triggers
 */
export function isNUPosition(text, longText) {
  const combined = lowerClean(text + ' ' + (longText || ''));
  const NU_KEYWORDS = [
    'fallschutzbelag', 'fallschutz epdm', 'fallschutz kautschuk', 'fallschutz gummigranulat',
    'fahrbahnmarkierung', 'markierung thermoplast', 'markierung kaltplast',
    'tüv', 'tuev', 'sachverständig', 'sachverstaendig',
    'inspektion din 1176', 'prüfung spielplatz', 'spielplatzprüfung',
  ];
  return NU_KEYWORDS.some(kw => combined.includes(kw));
}
