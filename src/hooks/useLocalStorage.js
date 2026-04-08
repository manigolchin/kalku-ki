import { useState, useCallback } from 'react';

/**
 * React Hook für persistente Speicherung im localStorage
 *
 * Speichert und liest Werte als JSON aus dem localStorage.
 * Bei Lesefehlern (z.B. korrupte Daten) wird der Initialwert verwendet.
 *
 * @param {string} key - localStorage Schlüssel
 * @param {*} initialValue - Initialwert, falls kein Wert im localStorage vorhanden
 * @returns {[*, Function]} [storedValue, setValue] - Gespeicherter Wert und Setter-Funktion
 *
 * @example
 * const [name, setName] = useLocalStorage('user_name', 'Max');
 */
export function useLocalStorage(key, initialValue) {
  // Initialwert aus localStorage lesen (lazy initialization)
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(
        `[useLocalStorage] Fehler beim Lesen von "${key}":`,
        error
      );
      return initialValue;
    }
  });

  // Setter-Funktion, die sowohl State als auch localStorage aktualisiert
  const setValue = useCallback(
    (value) => {
      try {
        // Unterstützt funktionale Updates wie bei useState
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(
          `[useLocalStorage] Fehler beim Schreiben von "${key}":`,
          error
        );
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

export default useLocalStorage;
