/**
 * KALKU-KI Marktpreisdatenbank
 * Plausibilitätsprüfung kalkulierter Einheitspreise
 * Preisstand: 2025/2026, Deutschland
 */

/**
 * Marktpreise (Richtwerte) in EUR je Mengeneinheit
 * Quellen: BKI, STLB-Bau, Marktbeobachtung
 *
 * Struktur: { [key]: { min, max, einheit, bezeichnung } }
 */
export const MARKTPREISE = {
  // =========================================================================
  // GaLaBau (Garten- und Landschaftsbau)
  // =========================================================================
  verbundpflaster_komplett: {
    min: 35,
    max: 65,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Verbundsteinpflaster, komplett (inkl. Bettung/Unterbau)',
  },
  natursteinpflaster_komplett: {
    min: 80,
    max: 180,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Natursteinpflaster, komplett verlegt',
  },
  platten_beton_komplett: {
    min: 40,
    max: 85,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Betonplatten, komplett verlegt',
  },
  rasen_ansaeen: {
    min: 3,
    max: 8,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Rasenansaat inkl. Bodenvorbereitung',
  },
  rollrasen: {
    min: 8,
    max: 18,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Rollrasen liefern und verlegen',
  },
  strauch_pflanzen: {
    min: 15,
    max: 45,
    einheit: 'EUR/St',
    bezeichnung: 'Strauch pflanzen (Solitär, inkl. Pflanzloch)',
  },
  hochstamm_pflanzen: {
    min: 250,
    max: 800,
    einheit: 'EUR/St',
    bezeichnung: 'Hochstamm pflanzen (StU 16-18, inkl. Verankerung)',
  },
  zaun_maschendraht: {
    min: 25,
    max: 55,
    einheit: 'EUR/m',
    bezeichnung: 'Maschendrahtzaun, h=1,50 m, komplett',
  },
  zaun_doppelstab: {
    min: 55,
    max: 120,
    einheit: 'EUR/m',
    bezeichnung: 'Doppelstabmattenzaun, h=1,60 m, komplett',
  },

  // =========================================================================
  // Tiefbau / Straßenbau / Kanalbau
  // =========================================================================
  oberboden_abtragen: {
    min: 2,
    max: 6,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Oberboden abtragen, d=20 cm, seitlich lagern',
  },
  aushub_normal: {
    min: 8,
    max: 22,
    einheit: 'EUR/m\u00B3',
    bezeichnung: 'Bodenaushub, Bodenklasse 3-5, laden und fördern',
  },
  entsorgung_boden: {
    min: 12,
    max: 35,
    einheit: 'EUR/m\u00B3',
    bezeichnung: 'Bodenentsorgung (Z0-Z1.1), inkl. Transport und Deponiegebühr',
  },
  asphalt_tragschicht_8cm: {
    min: 12,
    max: 25,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Asphalttragschicht AC 22 TS, d=8 cm',
  },
  asphalt_deckschicht_4cm: {
    min: 10,
    max: 22,
    einheit: 'EUR/m\u00B2',
    bezeichnung: 'Asphaltdeckschicht AC 11 DS, d=4 cm',
  },
  hochbord_setzen: {
    min: 22,
    max: 45,
    einheit: 'EUR/m',
    bezeichnung: 'Hochbord 15/25/100, setzen in Betonfundament',
  },
  tiefbord_setzen: {
    min: 16,
    max: 35,
    einheit: 'EUR/m',
    bezeichnung: 'Tiefbord 8/20/100, setzen in Betonfundament',
  },
  regenkanal_dn300: {
    min: 80,
    max: 180,
    einheit: 'EUR/m',
    bezeichnung: 'Regenwasserkanal DN 300, PP/PVC, komplett',
  },
  schacht_dn1000: {
    min: 2500,
    max: 5500,
    einheit: 'EUR/St',
    bezeichnung: 'Schachtbauwerk DN 1000, Fertigteil, komplett',
  },

  // =========================================================================
  // Spielplatz und Zaunbau
  // =========================================================================
  epdm_fallschutz: {
    min: 50,
    max: 100,
    einheit: 'EUR/m²',
    bezeichnung: 'EPDM Fallschutzbelag, komplett eingebaut',
  },
  holzzaun_einfach: {
    min: 35,
    max: 60,
    einheit: 'EUR/m',
    bezeichnung: 'Holzzaun einfach (Lärche), h=1,20 m, komplett',
  },
  stabgitterzaun: {
    min: 95,
    max: 140,
    einheit: 'EUR/m',
    bezeichnung: 'Stabgitterzaun h=1,80 m, komplett mit Pfosten',
  },
  wassergebundene_decke: {
    min: 40,
    max: 60,
    einheit: 'EUR/m²',
    bezeichnung: 'Wassergebundene Wegedecke, komplett',
  },

  // =========================================================================
  // Zusätzliche Tiefbau-Positionen
  // =========================================================================
  frostschutzschicht_30cm: {
    min: 33,
    max: 40,
    einheit: 'EUR/m³',
    bezeichnung: 'Frostschutzschicht 0/32, d=30 cm, liefern + einbauen',
  },
  strassenablauf: {
    min: 300,
    max: 500,
    einheit: 'EUR/St',
    bezeichnung: 'Straßenablauf mit Schlammfang, komplett',
  },
  hausanschluss_dn150: {
    min: 60,
    max: 100,
    einheit: 'EUR/m',
    bezeichnung: 'Hausanschlussleitung DN 150, komplett',
  },
  gemeindestrasse_komplett: {
    min: 330,
    max: 660,
    einheit: 'EUR/lfm',
    bezeichnung: 'Gemeindestraße 5,5 m breit, komplett (Fahrbahnbreite)',
  },
};

/**
 * Prüft einen kalkulierten Einheitspreis gegen Marktpreise
 *
 * Bewertung:
 * - plausibel: EP liegt innerhalb der Marktpreisspanne
 * - pruefen: EP weicht bis zu 30% von der Spanne ab
 * - kritisch: EP weicht mehr als 30% von der Spanne ab
 *
 * @param {string} positionKey - Schlüssel aus MARKTPREISE
 * @param {number} calculatedEP - Kalkulierter Einheitspreis in EUR
 * @returns {Object} Prüfergebnis
 */
export function checkMarktpreis(positionKey, calculatedEP) {
  const markt = MARKTPREISE[positionKey];

  if (!markt) {
    return {
      inRange: false,
      range: null,
      abweichung: 'Position nicht in Marktpreisdatenbank vorhanden.',
      status: 'pruefen',
    };
  }

  const ep = Number(calculatedEP) || 0;
  const { min, max, einheit, bezeichnung } = markt;

  if (ep >= min && ep <= max) {
    return {
      inRange: true,
      range: { min, max },
      abweichung: `EP ${formatEUR(ep)} liegt im Marktpreisbereich (${formatEUR(min)} - ${formatEUR(max)} ${einheit}).`,
      status: 'plausibel',
    };
  }

  // Abweichung berechnen: Wie weit liegt der EP außerhalb der Spanne?
  let abweichungProzent;
  let richtung;

  if (ep < min) {
    abweichungProzent = ((min - ep) / min) * 100;
    richtung = 'unter';
  } else {
    abweichungProzent = ((ep - max) / max) * 100;
    richtung = 'über';
  }

  const abweichungFormatted = Math.round(abweichungProzent * 10) / 10;
  const status = abweichungProzent > 30 ? 'kritisch' : 'pruefen';

  const statusText =
    status === 'kritisch'
      ? 'Erhebliche Abweichung - dringend prüfen!'
      : 'Leichte Abweichung - Kalkulation überprüfen.';

  return {
    inRange: false,
    range: { min, max },
    abweichung:
      `EP ${formatEUR(ep)} liegt ${abweichungFormatted}% ${richtung} dem Marktpreisbereich ` +
      `(${formatEUR(min)} - ${formatEUR(max)} ${einheit}) für "${bezeichnung}". ${statusText}`,
    status,
  };
}

/**
 * Gibt alle verfügbaren Positionsschlüssel zurück, gruppiert nach Gewerk
 * @returns {{ galabau: string[], tiefbau: string[] }}
 */
export function getAvailablePositions() {
  const galabauKeys = [
    'verbundpflaster_komplett',
    'natursteinpflaster_komplett',
    'platten_beton_komplett',
    'rasen_ansaeen',
    'rollrasen',
    'strauch_pflanzen',
    'hochstamm_pflanzen',
    'zaun_maschendraht',
    'zaun_doppelstab',
    'epdm_fallschutz',
    'holzzaun_einfach',
    'stabgitterzaun',
    'wassergebundene_decke',
  ];

  const tiefbauKeys = [
    'oberboden_abtragen',
    'aushub_normal',
    'entsorgung_boden',
    'asphalt_tragschicht_8cm',
    'asphalt_deckschicht_4cm',
    'hochbord_setzen',
    'tiefbord_setzen',
    'regenkanal_dn300',
    'schacht_dn1000',
    'frostschutzschicht_30cm',
    'strassenablauf',
    'hausanschluss_dn150',
    'gemeindestrasse_komplett',
  ];

  return { galabau: galabauKeys, tiefbau: tiefbauKeys };
}

// ---------------------------------------------------------------------------
// Intern
// ---------------------------------------------------------------------------

function formatEUR(value) {
  return Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' \u20AC';
}
