/**
 * KALKU-KI Kalkulationsfunktionen
 * Zuschlagskalkulation nach EFB 221 (Einheitliche Formblätter)
 * Deutsche Baukostenermittlung
 */

/**
 * Berechnet die Einzelkosten der Teilleistungen (EKT)
 * @param {number} lohn - Lohnkosten
 * @param {number} material - Stoffkosten / Materialkosten
 * @param {number} geraet - Gerätekosten
 * @param {number} sonstige - Sonstige Kosten
 * @param {number} nu - Nachunternehmerleistungen
 * @returns {number} Summe der EKT
 */
export function calculateEKT(lohn, material, geraet, sonstige, nu) {
  return (
    (Number(lohn) || 0) +
    (Number(material) || 0) +
    (Number(geraet) || 0) +
    (Number(sonstige) || 0) +
    (Number(nu) || 0)
  );
}

/**
 * Berechnet einen prozentualen Zuschlag auf eine Basis
 * @param {number} basis - Basisbetrag
 * @param {number} prozent - Zuschlagsprozentsatz (z.B. 10 für 10%)
 * @returns {number} Ergebnis mit Zuschlag
 */
export function calculateZuschlag(basis, prozent) {
  const b = Number(basis) || 0;
  const p = Number(prozent) || 0;
  return b * (1 + p / 100);
}

/**
 * Vollständige Einheitspreiskalkulation nach EFB 221 (Zuschlagskalkulation)
 *
 * Berechnungsschema:
 *   Lohn + Stoff + Gerät + Sonstige + NU = EKT
 *   EKT + BGK = Herstellkosten (HK)
 *   HK + AGK = Selbstkosten (SK)
 *   SK + W&G = Einheitspreis (EP)
 *
 * @param {Object} params
 * @param {number} params.aufwandswert - Aufwandswert in Stunden je Mengeneinheit (Std/ME)
 * @param {number} params.mittellohn - Mittellohn in EUR/Std (Kalkulationslohn inkl. Zulagen)
 * @param {number} params.materialpreis - Materialpreis je Mengeneinheit in EUR/ME
 * @param {number} params.materialverlust - Materialverlust in % (z.B. 5 für 5%)
 * @param {number} params.geraetKostensatz - Gerätekostensatz in EUR/Std
 * @param {number} params.geraetEinsatzzeit - Geräte-Einsatzzeit in Std/ME
 * @param {number} params.nuKosten - Nachunternehmer-Kosten je ME in EUR
 * @param {number} params.nuZuschlag - Zuschlag auf NU-Kosten in %
 * @param {number} params.bgk - Baustellengemeinkosten-Zuschlag in %
 * @param {number} params.agk - Allgemeine Geschäftskosten-Zuschlag in %
 * @param {number} params.wg - Wagnis und Gewinn in %
 * @returns {Object} Kalkulationsergebnis mit Aufschlüsselung
 */
export function calculateEP({
  aufwandswert = 0,
  mittellohn = 48,
  materialpreis = 0,
  materialverlust = 0,
  geraetKostensatz = 0,
  geraetEinsatzzeit = 0,
  nuKosten = 0,
  nuZuschlag = 0,
  bgk = 10,
  agk = 9,
  wg = 6,
}) {
  // 1. Einzelkosten der Teilleistungen (EKT)
  const lohn = roundCurrency(aufwandswert * mittellohn);
  const materialBrutto = roundCurrency(materialpreis * (1 + materialverlust / 100));
  const material = roundCurrency(materialBrutto);
  const geraet = roundCurrency(geraetKostensatz * geraetEinsatzzeit);
  const sonstige = 0;
  const nu = roundCurrency(nuKosten * (1 + nuZuschlag / 100));
  const ekt = roundCurrency(calculateEKT(lohn, material, geraet, sonstige, nu));

  // 2. Herstellkosten (HK) = EKT + BGK
  const bgkBetrag = roundCurrency(ekt * (bgk / 100));
  const hk = roundCurrency(ekt + bgkBetrag);

  // 3. Selbstkosten (SK) = HK + AGK
  const agkBetrag = roundCurrency(hk * (agk / 100));
  const sk = roundCurrency(hk + agkBetrag);

  // 4. Angebotspreis / Einheitspreis (EP) = SK + W&G
  const wgBetrag = roundCurrency(sk * (wg / 100));
  const ep = roundCurrency(sk + wgBetrag);

  // Aufschlüsselung (Breakdown) je Mengeneinheit
  const breakdown = [];

  if (lohn > 0) {
    breakdown.push({
      label: `Lohn: ${formatNumber(aufwandswert)} Std x ${formatCurrency(mittellohn)}/Std`,
      perUnit: lohn,
      anteil: ep > 0 ? roundPercent((lohn / ep) * 100) : 0,
    });
  }

  if (material > 0) {
    const verlustText =
      materialverlust > 0
        ? ` (inkl. ${formatNumber(materialverlust)}% Verlust)`
        : '';
    breakdown.push({
      label: `Stoff: ${formatCurrency(materialpreis)}/ME${verlustText}`,
      perUnit: material,
      anteil: ep > 0 ? roundPercent((material / ep) * 100) : 0,
    });
  }

  if (geraet > 0) {
    breakdown.push({
      label: `Gerät: ${formatNumber(geraetEinsatzzeit)} Std x ${formatCurrency(geraetKostensatz)}/Std`,
      perUnit: geraet,
      anteil: ep > 0 ? roundPercent((geraet / ep) * 100) : 0,
    });
  }

  if (nu > 0) {
    const nuText =
      nuZuschlag > 0
        ? ` (inkl. ${formatNumber(nuZuschlag)}% Zuschlag)`
        : '';
    breakdown.push({
      label: `Nachunternehmer: ${formatCurrency(nuKosten)}/ME${nuText}`,
      perUnit: nu,
      anteil: ep > 0 ? roundPercent((nu / ep) * 100) : 0,
    });
  }

  breakdown.push({
    label: `= Einzelkosten (EKT)`,
    perUnit: ekt,
    anteil: ep > 0 ? roundPercent((ekt / ep) * 100) : 0,
  });

  if (bgkBetrag > 0) {
    breakdown.push({
      label: `+ BGK (${formatNumber(bgk)}%)`,
      perUnit: bgkBetrag,
      anteil: ep > 0 ? roundPercent((bgkBetrag / ep) * 100) : 0,
    });
  }

  breakdown.push({
    label: `= Herstellkosten (HK)`,
    perUnit: hk,
    anteil: ep > 0 ? roundPercent((hk / ep) * 100) : 0,
  });

  if (agkBetrag > 0) {
    breakdown.push({
      label: `+ AGK (${formatNumber(agk)}%)`,
      perUnit: agkBetrag,
      anteil: ep > 0 ? roundPercent((agkBetrag / ep) * 100) : 0,
    });
  }

  breakdown.push({
    label: `= Selbstkosten (SK)`,
    perUnit: sk,
    anteil: ep > 0 ? roundPercent((sk / ep) * 100) : 0,
  });

  if (wgBetrag > 0) {
    breakdown.push({
      label: `+ W&G (${formatNumber(wg)}%)`,
      perUnit: wgBetrag,
      anteil: ep > 0 ? roundPercent((wgBetrag / ep) * 100) : 0,
    });
  }

  breakdown.push({
    label: `= Einheitspreis (EP)`,
    perUnit: ep,
    anteil: 100,
  });

  return {
    lohn,
    material,
    geraet,
    sonstige,
    nu,
    ekt,
    bgkBetrag,
    hk,
    agkBetrag,
    sk,
    wgBetrag,
    ep,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// Einheitenumrechnung
// ---------------------------------------------------------------------------

/**
 * Dichten gängiger Baustoffe in t/m³
 */
const MATERIALDICHTEN = {
  beton: 2.4,
  asphalt: 2.4,
  kies: 1.8,
  sand: 1.5,
  erde: 1.8,
  mutterboden: 1.6,
};

/**
 * Rechnet Volumen (m³) und Masse (t) eines Baustoffs um
 * @param {number} value - Ausgangswert
 * @param {'m3'|'t'} fromUnit - Ausgangseinheit
 * @param {'m3'|'t'} toUnit - Zieleinheit
 * @param {string} material - Materialbezeichnung (Key in MATERIALDICHTEN)
 * @returns {number} Umgerechneter Wert
 */
export function convertVolumeMass(value, fromUnit, toUnit, material) {
  const v = Number(value) || 0;
  const key = String(material).toLowerCase();
  const dichte = MATERIALDICHTEN[key];

  if (!dichte) {
    throw new Error(
      `Unbekanntes Material: "${material}". Verfügbar: ${Object.keys(MATERIALDICHTEN).join(', ')}`
    );
  }

  if (fromUnit === toUnit) return v;

  if (fromUnit === 'm3' && toUnit === 't') {
    return roundTo(v * dichte, 3);
  }

  if (fromUnit === 't' && toUnit === 'm3') {
    return roundTo(v / dichte, 3);
  }

  throw new Error(
    `Ungültige Einheitenkombination: ${fromUnit} -> ${toUnit}. Erlaubt: m3, t`
  );
}

// ---------------------------------------------------------------------------
// Auflockerungsfaktoren nach DIN 18300 / VOB/C
// ---------------------------------------------------------------------------

/**
 * Auflockerungsfaktoren nach Bodenklasse (DIN 18300 alt / VOB/C)
 */
const AUFLOCKERUNGSFAKTOREN = {
  '1-2': 1.05, // Oberboden, Fließende Bodenarten
  '3': 1.10,   // Leicht lösbare Bodenarten
  '4-5': 1.22, // Mittelschwer bis schwer lösbare Bodenarten
  '6-7': 1.37, // Leichter bis schwerer Fels
};

/**
 * Berechnet das aufgelockerte Volumen aus dem gewachsenen Volumen
 * @param {number} volumeGewachsen - Volumen in gewachsenem Zustand (m³)
 * @param {string} bodenklasse - Bodenklasse ('1-2', '3', '4-5', '6-7')
 * @returns {number} Aufgelockertes Volumen in m³
 */
export function calculateAuflockerung(volumeGewachsen, bodenklasse) {
  const v = Number(volumeGewachsen) || 0;
  const faktor = AUFLOCKERUNGSFAKTOREN[String(bodenklasse)];

  if (!faktor) {
    throw new Error(
      `Unbekannte Bodenklasse: "${bodenklasse}". Verfügbar: ${Object.keys(AUFLOCKERUNGSFAKTOREN).join(', ')}`
    );
  }

  return roundTo(v * faktor, 3);
}

// ---------------------------------------------------------------------------
// Flächenberechnung
// ---------------------------------------------------------------------------

/**
 * Berechnet Fläche und Volumen aus Länge, Breite und Schichtdicke
 * @param {number} laenge - Länge in Metern
 * @param {number} breite - Breite in Metern
 * @param {number} schichtdicke - Schichtdicke in Metern
 * @returns {{ flaeche_m2: number, volumen_m3: number }}
 */
export function calculateFlaeche(laenge, breite, schichtdicke) {
  const l = Number(laenge) || 0;
  const b = Number(breite) || 0;
  const d = Number(schichtdicke) || 0;

  const flaeche_m2 = roundTo(l * b, 3);
  const volumen_m3 = roundTo(flaeche_m2 * d, 3);

  return { flaeche_m2, volumen_m3 };
}

// ---------------------------------------------------------------------------
// VOB/B §2 Abs. 3 - Mengenabweichung
// ---------------------------------------------------------------------------

/**
 * Prüft Mengenabweichungen nach VOB/B §2 Abs. 3
 *
 * Regelung:
 * - Abweichung > +10%: Neuer Preis für die über 110% hinausgehende Menge
 * - Abweichung < -10%: Neuer Preis für die verbleibende Menge (Ausgleich der Unterdeckung)
 *
 * @param {number} vertragsmenge - Ursprünglich vereinbarte Menge (LV-Menge)
 * @param {number} istMenge - Tatsächlich ausgeführte / abgerechnete Menge
 * @returns {Object} Prüfergebnis
 */
export function checkVOB2Abs3(vertragsmenge, istMenge) {
  const vm = Number(vertragsmenge) || 0;
  const im = Number(istMenge) || 0;

  if (vm === 0) {
    return {
      abweichungProzent: 0,
      abweichungAbsolut: 0,
      ueberschreitung10: false,
      unterschreitung10: false,
      nachtragBerechtigt: false,
      regelung: 'Keine Vertragsmenge angegeben.',
    };
  }

  const abweichungAbsolut = roundTo(im - vm, 3);
  const abweichungProzent = roundPercent(((im - vm) / vm) * 100);
  const ueberschreitung10 = abweichungProzent > 10;
  const unterschreitung10 = abweichungProzent < -10;
  const nachtragBerechtigt = ueberschreitung10 || unterschreitung10;

  let regelung = '';

  if (ueberschreitung10) {
    const mehrmenge = roundTo(im - vm * 1.1, 3);
    regelung =
      `VOB/B §2 Abs. 3 Nr. 2: Mengenüberschreitung um ${formatNumber(Math.abs(abweichungProzent))}%. ` +
      `Die über 110% der Vertragsmenge (${formatNumber(vm * 1.1)} ME) hinausgehende Mehrmenge ` +
      `von ${formatNumber(mehrmenge)} ME ist auf Verlangen zum neuen Einheitspreis abzurechnen. ` +
      `Der neue Preis ist unter Berücksichtigung der Mehr- oder Minderkosten zu vereinbaren.`;
  } else if (unterschreitung10) {
    const mindermenge = roundTo(vm - im, 3);
    regelung =
      `VOB/B §2 Abs. 3 Nr. 3: Mengenunterschreitung um ${formatNumber(Math.abs(abweichungProzent))}%. ` +
      `Die Menge unterschreitet die Vertragsmenge um ${formatNumber(mindermenge)} ME (mehr als 10%). ` +
      `Der Auftragnehmer kann eine Erhöhung des Einheitspreises für die verbleibende Menge verlangen, ` +
      `sofern durch die Minderung der Menge die Kosten je Mengeneinheit gestiegen sind (Unterdeckung der Gemeinkosten).`;
  } else {
    regelung =
      `Mengenabweichung von ${formatNumber(abweichungProzent)}% liegt innerhalb der Toleranz von +/-10% ` +
      `nach VOB/B §2 Abs. 3. Keine Preisanpassung erforderlich. ` +
      `Abrechnung erfolgt zum vereinbarten Einheitspreis.`;
  }

  return {
    abweichungProzent,
    abweichungAbsolut,
    ueberschreitung10,
    unterschreitung10,
    nachtragBerechtigt,
    regelung,
  };
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen (intern)
// ---------------------------------------------------------------------------

/**
 * Rundet auf 2 Nachkommastellen (Währung)
 */
function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rundet auf n Nachkommastellen
 */
function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Rundet Prozentwerte auf 1 Nachkommastelle
 */
function roundPercent(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Formatiert eine Zahl mit deutschem Zahlenformat
 */
function formatNumber(value) {
  return Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Formatiert einen Betrag als EUR-Währung
 */
function formatCurrency(value) {
  return Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
