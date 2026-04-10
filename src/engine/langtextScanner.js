/**
 * LANGTEXT SCANNER — Detects modifiers in LV position long text
 *
 * Implements Leitfaden §0.8 (Meta-Regel Langtext-Modifikatoren)
 * These are DETERMINISTIC regex-based detections, no AI needed.
 */

// ─── MODIFIER DEFINITIONS ─────────────────────────────────────────
const MODIFIERS = [
  // ═══ FUNDAMENT & RÜCKENSTÜTZE (§4.2) ═══
  {
    id: 'inkl_fundament_und_rueckenstuetze',
    pattern: /inkl\.?\s*(fundament\s*(und|u\.?|u\s)\s*r[üu]ckenstuetz|r[üu]ckenstuetz\s*(und|u\.?)\s*fundament)/i,
    action: 'upgrade_bordstein',
    upgrade_to: 'bordstein_fundament_rueckenstuetze',
    beton_m3_lfm: 0.10,
    beton_eur_lfm: 20.00,
    zusatz_Y: 7, // +7 min/lfm for Fundamentaushub
    beschreibung: 'inkl. Fundament UND Rückenstütze → 0.10 m³/lfm × 200 = 20 EUR Beton',
  },
  {
    id: 'inkl_rueckenstuetze',
    pattern: /inkl\.?\s*r[üu]ckenstuetz|inkl\.?\s*r[üu]ckenbeton/i,
    excludeIf: 'inkl_fundament_und_rueckenstuetze', // don't double-fire
    action: 'add_nebenmaterial',
    nebenmaterial: 'rueckenbeton_einseitig',
    beton_m3_lfm: 0.05,
    beton_eur_lfm: 10.00,
    beschreibung: 'inkl. Rückenstütze → 0.05 m³/lfm × 200 = 10 EUR Beton',
  },
  {
    id: 'inkl_fundament',
    pattern: /inkl\.?\s*fundament/i,
    excludeIf: 'inkl_fundament_und_rueckenstuetze',
    action: 'add_nebenmaterial',
    nebenmaterial: 'fundament_beton',
    beton_m3_lfm: 0.05,
    beton_eur_lfm: 10.00,
    zusatz_Y: 7,
    beschreibung: 'inkl. Fundament → +7 min Aushub, Beton 0.05 m³/lfm',
  },

  // ═══ BETTUNG (§4.1) ═══
  {
    id: 'inkl_bettung',
    pattern: /inkl\.?\s*(bettung|splittbett|brechsandbett)/i,
    action: 'add_nebenmaterial',
    nebenmaterial: 'bettung_splitt',
    beschreibung: 'inkl. Bettung → Splitt-Material einrechnen',
  },

  // ═══ SCHNEIDEN/ANPASSEN (§4.3, §0.8) ═══
  {
    id: 'anpassen_trigger',
    pattern: /\banpassen\b/i,
    action: 'set_Z',
    Z_override: 15,
    beschreibung: 'Anpassen = Schneidearbeit → Z=15 (Nassschneider)',
  },

  // ═══ WECHSELFEUCHT (Runde 4) ═══
  {
    id: 'wechselfeucht',
    pattern: /wechselfeucht/i,
    action: 'multiply_Y',
    faktor: 2.0,
    beschreibung: 'Wechselfeucht → Erdarbeitswert verdoppeln',
  },

  // ═══ HÖHE / TIEFE EXTRACTION ═══
  {
    id: 'hoehe_cm',
    pattern: /(?:höhe|hoehe|h)\s*[=:]\s*(\d+(?:[,.]\d+)?)\s*(?:cm|mm)/i,
    action: 'extract_dimension',
    dimension: 'hoehe_cm',
    beschreibung: 'Höhe aus Langtext extrahiert',
  },
  {
    id: 'tiefe_m',
    pattern: /(?:tiefe|t|tief)\s*[=:]\s*(\d+(?:[,.]\d+)?)\s*m\b/i,
    action: 'extract_dimension',
    dimension: 'tiefe_m',
    beschreibung: 'Tiefe aus Langtext extrahiert',
  },
  {
    id: 'dicke_cm',
    pattern: /(?:dicke?|d|stärke)\s*[=:]\s*(\d+(?:[,.]\d+)?)\s*cm/i,
    action: 'extract_dimension',
    dimension: 'dicke_cm',
    beschreibung: 'Schichtdicke aus Langtext extrahiert',
  },
  {
    id: 'breite_cm',
    pattern: /(?:breite?|b)\s*[=:]\s*(\d+(?:[,.]\d+)?)\s*cm/i,
    action: 'extract_dimension',
    dimension: 'breite_cm',
    beschreibung: 'Breite aus Langtext extrahiert',
  },

  // ═══ BODENKLASSE ═══
  {
    id: 'bodenklasse',
    pattern: /(?:bodenklasse|bkl?\.?|bk)\s*(\d)(?:\s*[-–bis]\s*(\d))?/i,
    action: 'extract_bodenklasse',
    beschreibung: 'Bodenklasse extrahiert',
  },

  // ═══ BETON FESTIGKEITSKLASSE ═══
  {
    id: 'beton_klasse',
    pattern: /C\s*(\d+)\s*\/\s*(\d+)/,
    action: 'extract_betonklasse',
    beschreibung: 'Betonfestigkeitsklasse extrahiert (z.B. C20/25)',
  },

  // ═══ DN (Nennweite) ═══
  {
    id: 'dn_rohr',
    pattern: /DN\s*(\d+)/i,
    action: 'extract_dn',
    beschreibung: 'Nennweite DN extrahiert',
  },

  // ═══ SICHTBETON ═══
  {
    id: 'sichtbeton',
    pattern: /sichtbeton/i,
    action: 'upgrade_schalung',
    zusatz_Y: 20,
    zusatz_Z: 15,
    beschreibung: 'Sichtbeton → +20 min/m², +15 EUR/h Z',
  },

  // ═══ BEWEHRT/STAHLBETON ═══
  {
    id: 'bewehrt',
    pattern: /bewehr|stahlbeton/i,
    action: 'flag_stahlbeton',
    beschreibung: 'Stahlbeton/bewehrt erkannt',
  },

  // ═══ DIN 1176 / TÜV ═══
  {
    id: 'din1176',
    pattern: /din\s*1176|tüv|tuev/i,
    action: 'flag_nu',
    beschreibung: 'DIN 1176/TÜV → NU-Position',
  },

  // ═══ VERKEHRSLAST / BEFAHRBAR ═══
  {
    id: 'verkehrslast',
    pattern: /verkehrslast|befahrbar|slw\s*\d+|belastungsklasse/i,
    action: 'increase_quality',
    faktor: 1.15,
    beschreibung: 'Verkehrslast/befahrbar → +15% auf Standard',
  },

  // ═══ BORDSTEIN TYPERKENNUNG ═══
  {
    id: 'bordstein_typ',
    pattern: /\b(EF|TB|RB|HB)\s*(\d+)\s*\/\s*(\d+)\b/i,
    action: 'extract_bordstein_typ',
    beschreibung: 'Bordsteintyp erkannt (z.B. TB8/25)',
  },

  // ═══ PFLASTER DICKE ═══
  {
    id: 'pflaster_dicke',
    pattern: /(?:d|dicke?)\s*(?:=|:)?\s*(\d+)\s*(?:cm|mm)/i,
    action: 'extract_pflaster_dicke',
    beschreibung: 'Pflasterdicke aus Langtext',
  },

  // ═══ STAMMUMFANG ═══
  {
    id: 'stammumfang',
    pattern: /(?:StU|Stammumfang)\s*\.?\s*(\d+)(?:\s*[-–/]\s*(\d+))?/i,
    action: 'extract_stammumfang',
    beschreibung: 'Stammumfang extrahiert',
  },

  // ═══ SCHICHTDICKE FOR SCHÜTTGÜTER ═══
  {
    id: 'schichtdicke_schuettgut',
    pattern: /(?:schichtdicke|schichtst[äa]rke|einbaustärke|einbaudicke)\s*(?:=|:)?\s*(\d+(?:[,.]\d+)?)\s*cm/i,
    action: 'extract_dimension',
    dimension: 'schichtdicke_cm',
    beschreibung: 'Schichtdicke für Schüttgut/Tragschicht',
  },

  // ═══ SONDERFORM / SPEZIALPROFIL (§0.8) ═══
  {
    id: 'sonderform',
    pattern: /\bsonderform\b|sonderprofil|spezialprofil|sonderanfertigung/i,
    action: 'increase_quality',
    faktor: 1.25,
    beschreibung: 'Sonderform/Spezialprofil → +25% Aufwand (Anpassung, Zuschnitt)',
  },

  // ═══ HANDARBEIT MODIFIER ═══
  {
    id: 'handarbeit_modifier',
    pattern: /\bin\s+handarbeit\b|\bhandarbeit\b/i,
    action: 'multiply_Y',
    faktor: 3.0,
    beschreibung: 'Handarbeit → Y verdreifachen (kein Maschineneinsatz)',
  },

  // ═══ INKL. GENERIC (§0.8: "jede inkludierte Nebenleistung preislich abdecken") ═══
  {
    id: 'inkl_generic',
    pattern: /inkl\.?\s+([^,.;]{3,40})/i,
    excludeIf: 'inkl_fundament_und_rueckenstuetze', // don't fire if specific inkl already matched
    action: 'flag_inkl',
    beschreibung: 'inkl. Nebenleistung erkannt — muss preislich abgedeckt werden',
  },

  // ═══ BEWÄSSERUNG / ARBEITSGÄNGE (Pflege-Modifier) ═══
  {
    id: 'arbeitsgaenge',
    pattern: /(\d+)\s*(?:arbeitsg[äa]ng|ag\b|durchg[äa]ng)/i,
    action: 'extract_dimension',
    dimension: 'arbeitsgaenge',
    beschreibung: 'Anzahl Arbeitsgänge extrahiert (für Pflege-Positionen)',
  },

  // ═══ ZWEISEITIG (Bordstein beidseitig Beton) ═══
  {
    id: 'zweiseitig',
    pattern: /zweiseitig|beidseitig/i,
    action: 'flag_zweiseitig',
    beschreibung: 'Beidseitig → doppelter Betonverbrauch bei Bordsteinen',
  },

  // ═══ GROSSE MENGE / LIEFERUNG FREI BAUSTELLE ═══
  {
    id: 'frei_baustelle',
    pattern: /frei\s+(?:bau|einsatz)stelle/i,
    action: 'flag_frei_bs',
    beschreibung: 'Frei Baustelle — Lieferkosten im Preis enthalten',
  },
];


// ─── SCAN LANGTEXT ────────────────────────────────────────────────
/**
 * Scan a position's longText for all applicable modifiers
 * @param {string} longText - The full position description
 * @param {string} shortText - The short text (for context)
 * @returns {{ modifiers: Array, dimensions: Object, flags: Array }}
 */
export function scanLangtext(longText, shortText = '') {
  const text = (longText || '') + ' ' + (shortText || '');
  const found = [];
  const dimensions = {};
  const flags = [];
  const foundIds = new Set();

  for (const mod of MODIFIERS) {
    // Check exclusion
    if (mod.excludeIf && foundIds.has(mod.excludeIf)) continue;

    const match = text.match(mod.pattern);
    if (!match) continue;

    foundIds.add(mod.id);

    switch (mod.action) {
      case 'extract_dimension': {
        const val = parseFloat((match[1] || '').replace(',', '.'));
        if (!Number.isNaN(val) && val > 0) {
          dimensions[mod.dimension] = val;
          found.push({ ...mod, value: val });
        }
        break;
      }

      case 'extract_bodenklasse': {
        const bk_von = parseInt(match[1]);
        const bk_bis = match[2] ? parseInt(match[2]) : bk_von;
        dimensions.bodenklasse_von = bk_von;
        dimensions.bodenklasse_bis = bk_bis;
        found.push({ ...mod, value: `BK ${bk_von}-${bk_bis}` });
        break;
      }

      case 'extract_betonklasse':
        dimensions.beton_c = parseInt(match[1]);
        dimensions.beton_f = parseInt(match[2]);
        found.push({ ...mod, value: `C${match[1]}/${match[2]}` });
        break;

      case 'extract_dn':
        dimensions.dn = parseInt(match[1]);
        found.push({ ...mod, value: `DN${match[1]}` });
        break;

      case 'extract_bordstein_typ': {
        const typ = match[1].toUpperCase();
        const h = parseInt(match[2]);
        const b = parseInt(match[3]);
        dimensions.bordstein_typ = `${typ}${h}/${b}`;
        dimensions.bordstein_h = h;
        dimensions.bordstein_b = b;
        found.push({ ...mod, value: `${typ}${h}/${b}` });
        break;
      }

      case 'extract_pflaster_dicke':
        dimensions.pflaster_dicke_cm = parseInt(match[1]);
        found.push({ ...mod, value: parseInt(match[1]) });
        break;

      case 'extract_stammumfang': {
        const stu_von = parseInt(match[1]);
        const stu_bis = match[2] ? parseInt(match[2]) : stu_von;
        dimensions.stammumfang_von = stu_von;
        dimensions.stammumfang_bis = stu_bis;
        found.push({ ...mod, value: `StU ${stu_von}-${stu_bis}` });
        break;
      }

      case 'flag_stahlbeton':
      case 'flag_nu':
        flags.push(mod.id);
        found.push(mod);
        break;

      default:
        found.push(mod);
        break;
    }
  }

  return { modifiers: found, dimensions, flags };
}


/**
 * Apply modifiers to calculation values
 * @param {Object} baseValues - { Y, Z, X, ... } from regelwerk
 * @param {Array} modifiers - from scanLangtext().modifiers
 * @returns {Object} adjusted values + comments
 */
export function applyModifiers(baseValues, modifiers) {
  const adjusted = { ...baseValues };
  const comments = [];

  for (const mod of modifiers) {
    switch (mod.action) {
      case 'upgrade_bordstein':
        adjusted.Y = (adjusted.Y || 15) + (mod.zusatz_Y || 0);
        adjusted.nebenmaterial_beton_lfm = mod.beton_eur_lfm;
        adjusted.nebenmaterial_beton_m3_lfm = mod.beton_m3_lfm;
        comments.push(mod.beschreibung);
        break;

      case 'add_nebenmaterial':
        if (mod.beton_eur_lfm) {
          adjusted.nebenmaterial_beton_lfm = (adjusted.nebenmaterial_beton_lfm || 0) + mod.beton_eur_lfm;
          adjusted.nebenmaterial_beton_m3_lfm = (adjusted.nebenmaterial_beton_m3_lfm || 0) + (mod.beton_m3_lfm || 0);
        }
        if (mod.zusatz_Y) {
          adjusted.Y = (adjusted.Y || 0) + mod.zusatz_Y;
        }
        comments.push(mod.beschreibung);
        break;

      case 'set_Z':
        adjusted.Z = mod.Z_override;
        comments.push(mod.beschreibung);
        break;

      case 'multiply_Y':
        if (mod.faktor > 0) {
          adjusted.Y = (adjusted.Y || 0) * mod.faktor;
          comments.push(mod.beschreibung);
        }
        break;

      case 'upgrade_schalung':
        adjusted.Y = (adjusted.Y || 0) + (mod.zusatz_Y || 0);
        adjusted.Z = (adjusted.Z || 0) + (mod.zusatz_Z || 0);
        comments.push(mod.beschreibung);
        break;

      case 'increase_quality':
        adjusted.Y = (adjusted.Y || 0) * (mod.faktor || 1);
        comments.push(mod.beschreibung);
        break;

      default:
        break;
    }
  }

  return { values: adjusted, comments };
}
