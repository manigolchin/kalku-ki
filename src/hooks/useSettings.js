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
