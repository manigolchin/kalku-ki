/**
 * MATERIAL DECOMPOSER — Finds ALL materials for each position type
 *
 * For every classified position, determines:
 * - Hauptmaterial (main material) — price from Angebot/waterfall
 * - Nebenmaterial (secondary materials) — calculated from formulas
 * - Checks if Nebenmaterial exists as separate LV position → skip if yes
 */

import { BETONPREISE, BORDSTEIN_PREISE, ERFAHRUNGSPREISE, NEBENMATERIAL } from './regelwerk.js';

// ─── MATERIAL RECIPES PER POSITION TYPE ───────────────────────────
const RECIPES = {

  // ═══ BORDSTEIN ═══
  bordstein_setzen: {
    hauptmaterial: {
      typ: 'bordstein',
      preisquelle: 'angebot_oder_typ',
      einheit: 'lfm',
    },
    nebenmaterial: [
      {
        id: 'rueckenbeton_einseitig',
        label: 'Rückenbeton einseitig',
        formel: () => {
          const m3 = 0.05;
          const preis = BETONPREISE.kleinmenge;
          return { menge_m3: m3, preis_eur_lfm: m3 * preis, einheit: 'lfm', formel: `0.05 m³/lfm × ${preis} €/m³ = ${m3 * preis} €/lfm` };
        },
        check_separate: ['beton', 'frischbeton', 'fundament'],
      },
    ],
  },

  bordstein_fundament_rueckenstuetze: {
    hauptmaterial: {
      typ: 'bordstein',
      preisquelle: 'angebot_oder_typ',
      einheit: 'lfm',
    },
    nebenmaterial: [
      {
        id: 'fundament_und_rueckenstuetze',
        label: 'Fundament + Rückenstütze (beidseitig)',
        formel: () => {
          const m3 = 0.10;
          const preis = BETONPREISE.kleinmenge;
          return { menge_m3: m3, preis_eur_lfm: m3 * preis, einheit: 'lfm', formel: `0.10 m³/lfm × ${preis} €/m³ = ${m3 * preis} €/lfm` };
        },
        check_separate: ['beton', 'frischbeton', 'fundament'],
      },
    ],
  },

  tiefbord_setzen: {
    hauptmaterial: {
      typ: 'bordstein',
      preisquelle: 'angebot_oder_typ',
      einheit: 'lfm',
    },
    nebenmaterial: [
      {
        id: 'rueckenbeton_einseitig',
        label: 'Rückenbeton einseitig',
        formel: () => ({
          menge_m3: 0.05,
          preis_eur_lfm: 0.05 * BETONPREISE.kleinmenge,
          einheit: 'lfm',
          formel: `0.05 m³/lfm × ${BETONPREISE.kleinmenge} €/m³ = ${0.05 * BETONPREISE.kleinmenge} €/lfm`,
        }),
        check_separate: ['beton', 'frischbeton'],
      },
    ],
  },

  // ═══ PFLASTER ═══
  pflaster_standard: {
    hauptmaterial: {
      typ: 'pflasterstein',
      preisquelle: 'angebot',
      einheit: 'm²',
    },
    nebenmaterial: [
      {
        id: 'bettung_splitt',
        label: 'Splitt-Bettung',
        formel: (dims) => {
          const dicke_cm = dims?.bettung_dicke_cm || 4; // Standard 4cm
          const dicke_m = dicke_cm / 100;
          // Splitt 0/5: ~32 €/t, Dichte 1.55 t/m³ → ~20.65 €/m³
          // Bettung/m² = dicke_m × 20.65 €/m³
          const splitt_preis_m3 = 32 / 1.55; // ~20.65 €/m³
          const preis_m2 = Math.round(dicke_m * splitt_preis_m3 * 100) / 100;
          return {
            menge_m3_m2: dicke_m,
            preis_eur: preis_m2,
            einheit: 'm²',
            formel: `${dicke_cm}cm × ${splitt_preis_m3.toFixed(2)} €/m³ = ${preis_m2} €/m²`,
          };
        },
        check_separate: ['bettung', 'splitt', 'brechsand'],
      },
      {
        id: 'fugenmaterial',
        label: 'Fugenmaterial',
        formel: () => {
          // Fugensand 0/2: ~32 €/t, 8 kg/m² = 0.008 t/m² → 0.26 €/m²
          const preis_m2 = Math.round(8 * (32 / 1000) * 100) / 100; // 0.26
          return {
            verbrauch_kg_m2: 8,
            preis_eur: preis_m2,
            einheit: 'm²',
            formel: `8 kg/m² × 32 €/t = ${preis_m2} €/m²`,
          };
        },
        check_separate: ['fugenmaterial', 'fugensand'],
      },
    ],
  },

  pflaster_aufwaendig: {
    hauptmaterial: {
      typ: 'pflasterstein',
      preisquelle: 'angebot',
      einheit: 'm²',
    },
    nebenmaterial: [
      {
        id: 'bettung_splitt',
        label: 'Splitt-Bettung',
        formel: (dims) => {
          const dicke_cm = dims?.bettung_dicke_cm || 4;
          const dicke_m = dicke_cm / 100;
          const splitt_preis_m3 = 32 / 1.55;
          const preis_m2 = Math.round(dicke_m * splitt_preis_m3 * 100) / 100;
          return {
            menge_m3_m2: dicke_m,
            preis_eur: preis_m2,
            einheit: 'm²',
            formel: `${dicke_cm}cm × ${splitt_preis_m3.toFixed(2)} €/m³ = ${preis_m2} €/m²`,
          };
        },
        check_separate: ['bettung', 'splitt'],
      },
    ],
  },

  // ═══ BETON ═══
  betonieren_rein: {
    hauptmaterial: {
      typ: 'beton',
      preisquelle: 'beton_menge',
      einheit: 'm³',
    },
    nebenmaterial: [],
  },

  betonieren_inkl_aushub: {
    hauptmaterial: {
      typ: 'beton',
      preisquelle: 'beton_menge',
      einheit: 'm³',
    },
    nebenmaterial: [], // Aushub is in the Y-time
  },

  betonieren_inkl_schalung: {
    hauptmaterial: {
      typ: 'beton',
      preisquelle: 'beton_menge',
      einheit: 'm³',
    },
    nebenmaterial: [
      {
        id: 'schalungsmaterial',
        label: 'Schalungsmaterial',
        formel: () => ({
          needs_price: 'schalung',
          hinweis: 'Schalungsmaterial je nach Typ',
        }),
        check_separate: ['schalung'],
      },
    ],
  },

  // ═══ SCHÜTTGÜTER ═══
  einbau_grossflaechig: {
    hauptmaterial: {
      typ: 'schuettgut',
      preisquelle: 'angebot',
      conversion: 't_to_unit',
      einheit: 'dynamic',
    },
    nebenmaterial: [],
  },

  einbau_kleinmenge: {
    hauptmaterial: {
      typ: 'schuettgut',
      preisquelle: 'angebot',
      conversion: 't_to_unit',
      einheit: 'dynamic',
    },
    nebenmaterial: [],
  },

  einbau_kleinmenge_m2: {
    hauptmaterial: {
      typ: 'schuettgut',
      preisquelle: 'angebot',
      conversion: 't_to_unit',
      einheit: 'dynamic',
    },
    nebenmaterial: [],
  },

  // ═══ SCHWERE BAUTEILE ═══
  schacht_setzen: {
    hauptmaterial: {
      typ: 'schacht',
      preisquelle: 'angebot',
      einheit: 'St',
    },
    nebenmaterial: [
      {
        id: 'beton_schacht',
        label: 'Beton für Schachteinbau',
        formel: (dims) => ({
          menge_m3: dims?.beton_m3 || 0.3,
          preis_eur: (dims?.beton_m3 || 0.3) * BETONPREISE.kleinmenge,
          einheit: 'St',
          formel: `${dims?.beton_m3 || 0.3} m³ × ${BETONPREISE.kleinmenge} €/m³`,
        }),
        check_separate: ['beton', 'frischbeton'],
      },
    ],
  },

  doppelstabmatte: {
    hauptmaterial: {
      typ: 'zaun',
      preisquelle: 'angebot',
      einheit: 'lfm',
      fallback_preis: ERFAHRUNGSPREISE.doppelstabmatte_h183.preis,
    },
    nebenmaterial: [],
  },

  zaunpfosten: {
    hauptmaterial: {
      typ: 'pfosten',
      preisquelle: 'angebot',
      einheit: 'St',
    },
    nebenmaterial: [
      {
        id: 'beton_pfosten',
        label: 'Beton für Pfostenfundament',
        formel: () => ({
          menge_m3: 0.03, // ca. 30l pro Pfosten
          preis_eur: 0.03 * BETONPREISE.kleinmenge,
          einheit: 'St',
          formel: `0.03 m³ × ${BETONPREISE.kleinmenge} €/m³ = ${(0.03 * BETONPREISE.kleinmenge).toFixed(2)} €/St`,
        }),
        check_separate: ['beton', 'fundament'],
      },
    ],
  },

  drehfluegeltuer: {
    hauptmaterial: {
      typ: 'tor',
      preisquelle: 'angebot',
      einheit: 'St',
    },
    nebenmaterial: [
      {
        id: 'beton_tor',
        label: 'Beton für Torfundament',
        formel: () => ({
          menge_m3: 0.5,
          preis_eur: 0.5 * BETONPREISE.kleinmenge,
          einheit: 'St',
          formel: `0.5 m³ × ${BETONPREISE.kleinmenge} €/m³`,
        }),
        check_separate: ['beton', 'fundament'],
      },
    ],
  },

  rinne_im_beton: {
    hauptmaterial: {
      typ: 'rinne',
      preisquelle: 'angebot',
      einheit: 'lfm',
    },
    nebenmaterial: [
      {
        id: 'beton_rinne',
        label: 'Beton für Rinnenbettung',
        formel: () => ({
          menge_m3_lfm: 0.04,
          preis_eur_lfm: 0.04 * BETONPREISE.kleinmenge,
          einheit: 'lfm',
          formel: `0.04 m³/lfm × ${BETONPREISE.kleinmenge} €/m³`,
        }),
        check_separate: ['beton'],
      },
    ],
  },

  // ═══ PFLANZEN ═══
  baum_pflanzen: {
    hauptmaterial: {
      typ: 'baum',
      preisquelle: 'angebot',
      einheit: 'St',
    },
    nebenmaterial: [
      {
        id: 'verankerung',
        label: 'Baumpfahl/Verankerung',
        formel: () => ({
          pauschal_eur: 25,
          einheit: 'St',
          formel: 'Baumpfahl + Bindung ca. 25 €/St',
          needs_price: 'baumpfahl',
        }),
        check_separate: ['pfahl', 'verankerung', 'anbindung'],
      },
    ],
  },

  baum_liefern: {
    hauptmaterial: {
      typ: 'baum',
      preisquelle: 'angebot',
      einheit: 'St',
    },
    nebenmaterial: [],
  },

  // ═══ POSITIONS WITHOUT MATERIAL ═══
  // Earthwork, demolition, leveling — X = 0
};

// Positions where X is ALWAYS 0 (pure labor)
const KEINE_MATERIAL_LEISTUNGEN = new Set([
  'aushub_grossmaschine', 'aushub_handarbeit', 'aushub_minibagger',
  'einbau_grossmaschine', 'einbau_minibagger', 'transport_innerhalb',
  'planieren', 'verdichten', 'planieren_verdichten_m3',
  'oberboden_abtragen',
  'abbruch_mauerwerk', 'abbruch_asphalt', 'abbruch_beton', 'abbruch_stahlbeton',
  'schneiden_pflaster_beton', 'schneiden_stahlbeton', 'schneiden_asphalt',
  'schalung', 'schalung_sichtbeton',
  'schutzzaun_herstellen', 'schutzzaun_versetzen',
  'be_einrichten_galabau', 'be_einrichten_sonstige', 'be_raeumen',
  'rasen_saatbett',
  'maehen', 'waessern_pflanzung', 'waessern_rasen', 'fertigstellungspflege',
]);


// ─── MAIN FUNCTION ────────────────────────────────────────────────

/**
 * Decompose a position into all required materials
 * @param {string} leistungKey - The classified leistung key
 * @param {Object} dimensions - Extracted dimensions from langtextScanner
 * @param {Array} allPositions - All LV positions (to check for separate Nebenmaterial)
 * @param {number} currentIndex - Current position index
 * @returns {{ hauptmaterial, nebenmaterial[], X_rein_arbeit, hinweise[] }}
 */
export function decomposeMaterials(leistungKey, dimensions, allPositions = [], currentIndex = 0) {
  const result = {
    hauptmaterial: null,
    nebenmaterial: [],
    X_rein_arbeit: false,
    hinweise: [],
  };

  // Check if this is a pure labor position (X = 0)
  if (KEINE_MATERIAL_LEISTUNGEN.has(leistungKey)) {
    result.X_rein_arbeit = true;
    result.hinweise.push('Reine Arbeitsleistung — X = 0');
    return result;
  }

  // Look up the recipe
  const recipe = RECIPES[leistungKey];
  if (!recipe) {
    result.hinweise.push(`Kein Material-Rezept für "${leistungKey}" — manuell prüfen`);
    return result;
  }

  // Main material
  result.hauptmaterial = { ...recipe.hauptmaterial };

  // Resolve Bordstein type price
  if (recipe.hauptmaterial.typ === 'bordstein' && dimensions?.bordstein_typ) {
    const typPreis = BORDSTEIN_PREISE[dimensions.bordstein_typ];
    if (typPreis) {
      result.hauptmaterial.fallback_preis = typPreis;
      result.hauptmaterial.fallback_quelle = `Erfahrungspreis ${dimensions.bordstein_typ}`;
    }
  }

  // Resolve Beton price based on quantity
  if (recipe.hauptmaterial.preisquelle === 'beton_menge') {
    // Will be determined at calc time based on project volume
    result.hauptmaterial.preis_klein = BETONPREISE.kleinmenge;
    result.hauptmaterial.preis_lkw = BETONPREISE.lkw_inkl_pumpe;
    result.hauptmaterial.schwelle = BETONPREISE.schwelle_m3;
  }

  // Process Nebenmaterial
  for (const neben of (recipe.nebenmaterial || [])) {
    // Check if this material exists as a separate LV position
    const existsSeparately = checkSeparatePosition(neben.check_separate, allPositions, currentIndex);

    if (existsSeparately) {
      result.hinweise.push(`${neben.label}: in sep. Pos. ${existsSeparately.oz} → hier nicht eingerechnet`);
      continue;
    }

    // Calculate the Nebenmaterial
    const calculated = neben.formel(dimensions || {});
    result.nebenmaterial.push({
      id: neben.id,
      label: neben.label,
      ...calculated,
    });
  }

  return result;
}


/**
 * Check if a Nebenmaterial exists as a separate LV position
 */
function checkSeparatePosition(keywords, allPositions, currentIndex) {
  if (!keywords || keywords.length === 0 || !allPositions || allPositions.length === 0) return null;

  for (let i = 0; i < allPositions.length; i++) {
    if (i === currentIndex) continue;
    const pos = allPositions[i];
    if (pos.is_header) continue;

    const searchText = ((pos.short_text || '') + ' ' + (pos.long_text || '')).toLowerCase();
    for (const kw of keywords) {
      if (searchText.includes(kw.toLowerCase())) {
        return { oz: pos.oz, text: pos.short_text };
      }
    }
  }

  return null;
}


/**
 * Calculate total X (material cost) from hauptmaterial + nebenmaterial
 * @param {Object} decomposition - Result from decomposeMaterials
 * @param {number} hauptPreis - Resolved price for Hauptmaterial (from Angebot/waterfall)
 * @returns {{ X_total, formel_parts[], quellen[] }}
 */
export function calculateMaterialX(decomposition, hauptPreis = 0) {
  if (decomposition.X_rein_arbeit) {
    return { X_total: 0, formel_parts: ['Reine Arbeit → X=0'], quellen: [] };
  }

  const parts = [];
  const quellen = [];
  let total = 0;

  // Hauptmaterial
  if (hauptPreis > 0) {
    total += hauptPreis;
    parts.push(`Hauptmaterial: ${hauptPreis.toFixed(2)} €`);
  }

  // Nebenmaterial
  for (const neben of decomposition.nebenmaterial) {
    const nebenPreis = neben.preis_eur_lfm || neben.preis_eur || neben.pauschal_eur || 0;
    if (nebenPreis > 0) {
      total += nebenPreis;
      parts.push(`${neben.label}: ${nebenPreis.toFixed(2)} € (${neben.formel})`);
    }
  }

  return {
    X_total: Math.round(total * 100) / 100,
    formel_parts: parts,
    quellen,
  };
}
