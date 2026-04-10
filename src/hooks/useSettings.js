import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * Regionale Mittellohn-Richtwerte (EUR/Std)
 * Kalkulationslohn inkl. Lohnzusatzkosten, Sozialkosten, Zuschläge
 */
export const REGION_MITTELLOHN = {
  west: 48,
  ost: 42,
  sued: 50,
  nord: 46,
  bayern: 50,
  nrw: 49,
  saarland: 46,
};

/**
 * Gewerk-Informationen mit Beschreibungen und typischen Aufwandswerten
 */
export const GEWERK_INFO = {
  galabau: {
    label: 'GaLaBau',
    beschreibung:
      'Garten- und Landschaftsbau. Typische Aufwandswerte: ' +
      'Pflasterarbeiten 0,35-0,55 Std/m\u00B2, Erdarbeiten 0,08-0,15 Std/m\u00B3, ' +
      'Pflanzarbeiten 0,15-0,40 Std/St, Rasenansaat 0,02-0,04 Std/m\u00B2.',
  },
  tiefbau: {
    label: 'Tiefbau',
    beschreibung:
      'Stra\u00DFen-, Kanal- und Leitungsbau. Typische Aufwandswerte: ' +
      'Rohrverlegung DN 200: 0,25-0,45 Std/m, Grabenverbau 0,30-0,60 Std/m\u00B2, ' +
      'Asphalttragschicht 0,03-0,06 Std/m\u00B2, Bordsteinsetzen 0,20-0,35 Std/m.',
  },
  hochbau: {
    label: 'Hochbau',
    beschreibung:
      'Geb\u00E4ude- und Rohbauarbeiten. Typische Aufwandswerte: ' +
      'Mauerwerk 1,5-2,5 Std/m\u00B2, Betonage 0,8-1,5 Std/m\u00B3, ' +
      'Schalung 0,5-1,0 Std/m\u00B2, Bewehrung 8-15 Std/t.',
  },
};

/**
 * Standard-Kalkulationseinstellungen für KALKU-KI
 * Gesellchen GmbH Defaults aus Kalkulations_Leitfaden v1.3
 */
const DEFAULT_SETTINGS = {
  /** Mittellohn (Kalkulationslohn) in EUR/Std */
  mittellohn: 48,
  /** Baustellengemeinkosten-Zuschlag in % */
  bgk: 10,
  /** Allgemeine Geschäftskosten-Zuschlag in % */
  agk: 9,
  /** Wagnis und Gewinn in % */
  wg: 6,
  /** Region (beeinflusst regionale Preisanpassungen) */
  region: 'west',
  /** Gewerk / Branche */
  gewerk: 'galabau',

  // ─── Leitfaden-Grundwerte (Kalkulations_Leitfaden §0) ─────────
  /** Verrechnungslohn / Stundensatz (Leitfaden §0.1) */
  stundensatz: 72.51,
  /** Zuschlag Material % (Leitfaden §0.2) */
  zuschlag_material: 20,
  /** Zuschlag NU % (Leitfaden §0.2) */
  zuschlag_nu: 20,
  /** Default Gerätezulage EUR/h (Leitfaden §0.3) */
  geraete_default: 0.50,

  // ─── Zeitvorgaben pro Gewerk (anpassbar, Leitfaden §1-6) ──────
  // §1 Baustelleneinrichtung
  be_einrichten_Y: 1800,    // min (30h)
  be_einrichten_Z: 50,      // EUR/h
  be_raeumen_Y: 600,        // min (10h)
  be_raeumen_Z: 15,         // EUR/h
  be_vorhalten_Y_tag: 10,   // min/Arbeitstag
  be_vorhalten_Z: 30,       // EUR/h

  // §2 Erdarbeiten
  aushub_gross_Y: 2,        // min/m³
  aushub_gross_Z: 25,       // EUR/h
  aushub_hand_Y_min: 240,   // min/m³ (offen)
  aushub_hand_Y_max: 360,   // min/m³ (Wurzelbereich)
  aushub_mini_Y: 10,        // min/m³
  aushub_mini_Z: 15,        // EUR/h

  // §3 Schüttgüter
  schuett_gross_Y: 3,       // min/m³
  schuett_gross_Z: 25,      // EUR/h
  schuett_klein_Y: 20,      // min/m³
  schuett_klein_Z: 15,      // EUR/h
  schuett_klein_schwelle: 200, // m² (Grenze Groß/Klein)

  // §4 Pflaster/Bord
  pflaster_Y: 25,           // min/m² (Mindestens)
  pflaster_Z: 5,            // EUR/h
  bordstein_Y: 15,          // min/lfm
  bordstein_Z: 5,           // EUR/h
  tiefbord_Y: 12,           // min/lfm
  beton_ruecken_m3_lfm: 0.05, // m³/lfm Rückenbeton
  beton_fundament_m3_lfm: 0.10, // m³/lfm inkl. Fundament

  // §5 Beton/Abbruch
  beton_klein_preis: 200,   // EUR/m³ (1-2 m³)
  beton_lkw_preis: 150,     // EUR/m³ (inkl. Pumpe)
  betonieren_Y: 30,         // min/m³
  abbruch_asphalt_Y: 15,    // min/m³
  abbruch_mauerwerk_Y: 30,  // min/m³
  abbruch_beton_Y: 45,      // min/m³
  abbruch_stahlbeton_Y: 90, // min/m³

  // §6 Pflanzen
  baum_pflanzen_Y: 120,     // min/St
  hecke_Y: 4,               // min/St
  strauch_Y: 6,             // min/St
  rasen_saatbett_Y: 1.5,    // min/m²
  rasen_einsaat_Y: 0.5,     // min/m²
  spielgeraet_Z: 5,         // EUR/h (nicht Default 0.50!)

  // Schneiden
  schneiden_pflaster_Y_m2: 187, // min/m²
  schneiden_asphalt_Y_m2: 120,  // min/m²
  schneiden_stahlbeton_Y_m2: 300, // min/m²
  schneiden_Z: 15,           // EUR/h (Nassschneider)
};

const STORAGE_KEY = 'kalku_settings';

/**
 * React Hook für KALKU-KI Kalkulationseinstellungen
 *
 * Persistiert Einstellungen im localStorage unter dem Schlüssel 'kalku_settings'.
 * Bietet Funktionen für partielle Updates und Zurücksetzung auf Standardwerte.
 *
 * @returns {{ settings: Object, updateSettings: Function, resetSettings: Function, gewerkInfo: Object }}
 *
 * @example
 * const { settings, updateSettings, resetSettings } = useSettings();
 * updateSettings({ mittellohn: 52, bgk: 12 });
 */
export function useSettings() {
  const [settings, setSettings] = useLocalStorage(STORAGE_KEY, DEFAULT_SETTINGS);

  /**
   * Aktualisiert einzelne Einstellungen (partielle Updates)
   * Nicht angegebene Felder bleiben unverändert.
   * Bei Regionswechsel wird der Mittellohn automatisch auf den regionalen Richtwert gesetzt.
   *
   * @param {Partial<typeof DEFAULT_SETTINGS>} partial - Zu aktualisierende Felder
   */
  const updateSettings = useCallback(
    (partial) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };

        // Bei Regionswechsel Mittellohn auf regionalen Richtwert setzen
        if (
          partial.region &&
          partial.region !== prev.region &&
          REGION_MITTELLOHN[partial.region] !== undefined
        ) {
          next.mittellohn = REGION_MITTELLOHN[partial.region];
        }

        return next;
      });
    },
    [setSettings]
  );

  /**
   * Setzt alle Einstellungen auf die Standardwerte zurück
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, [setSettings]);

  /**
   * Aktuelle Gewerk-Informationen (abgeleitet aus settings.gewerk)
   */
  const gewerkInfo = useMemo(
    () =>
      GEWERK_INFO[(settings || DEFAULT_SETTINGS).gewerk] || GEWERK_INFO.galabau,
    [settings]
  );

  return {
    settings: settings || DEFAULT_SETTINGS,
    updateSettings,
    resetSettings,
    gewerkInfo,
  };
}

export { DEFAULT_SETTINGS };
export default useSettings;
