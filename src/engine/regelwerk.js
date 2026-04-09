/**
 * REGELWERK — Complete calculation rules from Kalkulations_Leitfaden v1.3
 *
 * This is the "brain" of the calculation system.
 * ALL values are from Gesellchen GmbH's Leitfaden, knowledge_base.json, and kalk_feedback.md.
 *
 * Structure: Each Gewerk has categories, each category has Leistungen.
 * Each Leistung defines Y (minutes), Z (equipment EUR/h), X rules, and modifiers.
 */

// ─── FIRMA GRUNDWERTE ─────────────────────────────────────────────
export const FIRMA_DEFAULTS = {
  stundensatz: 72.51,        // EUR/h
  zuschlag_material: 0.20,   // 20%
  zuschlag_nu: 0.20,         // 20%
  geraete_default: 0.50,     // EUR/h Kleingeräte
  mwst: 0.19,                // 19%
};

// ─── FARBEN ───────────────────────────────────────────────────────
export const FARBEN = {
  angebot: '#E2EFDA',        // grün — belegt durch Angebot
  annahme: '#FFF2CC',        // gelb — Annahme/Erfahrungswert
  achtung: '#F8CBAD',        // rot — unsicher, prüfen
  aa_override: '#FFF2CC',    // gelb — AA Override
};

// ─── SCHÜTTDICHTEN (t/m³) ────────────────────────────────────────
export const SCHUETTDICHTEN = {
  sts_0_32:          { lose: 1.80, verdichtung: 1.15, verschnitt: 0.05, label: 'STS 0/32 Andesit' },
  schotter_22_32:    { lose: 1.55, verdichtung: 1.10, verschnitt: 0.05, label: 'Schotter 22/32' },
  frostschutz_0_56:  { lose: 1.85, verdichtung: 1.15, verschnitt: 0.05, label: 'Frostschutz 0/56' },
  bettmaterial_0_5:  { lose: 1.60, verdichtung: 1.00, verschnitt: 0.05, label: 'Bettmaterial Pflaster 0/5' },
  brechsand_2_5:     { lose: 1.55, verdichtung: 1.00, verschnitt: 0.05, label: 'Brechsand/Splitt 2/5' },
  fugenmaterial_0_2: { lose: 1.55, verdichtung: 1.00, verschnitt: 0.00, label: 'Fugenmaterial 0/2', verbrauch_kg_m2: 8 },
  rheinsand_0_2:     { lose: 1.60, verdichtung: 1.00, verschnitt: 0.05, label: 'Rheinsand 0/2' },
  fallschutzsand:    { lose: 1.55, verdichtung: 1.00, verschnitt: 0.05, label: 'Fallschutzsand 0,2/2', norm: 'DIN EN 1177' },
  mutterboden:       { lose: 1.50, verdichtung: 1.00, verschnitt: 0.05, label: 'Mutterboden gesiebt' },
  asphalt:           { lose: 2.20, verdichtung: 1.00, verschnitt: 0.00, label: 'Asphaltaufbruch/Entsorgung' },
  erdaushub:         { lose: 1.80, verdichtung: 1.00, verschnitt: 0.00, label: 'Erdaushub BM 0' },
  rc_schotter:       { lose: 1.80, verdichtung: 1.14, verschnitt: 0.05, label: 'RC-Schotter' },
  beton:             { lose: 2.30, verdichtung: 1.00, verschnitt: 0.05, label: 'Beton C12/15' },
  asphaltmischgut:   { lose: 2.40, verdichtung: 1.00, verschnitt: 0.00, label: 'Asphaltmischgut (Einbau)' },
  kies:              { lose: 1.80, verdichtung: 1.00, verschnitt: 0.05, label: 'Kies' },
  sand:              { lose: 1.60, verdichtung: 1.00, verschnitt: 0.05, label: 'Sand' },
};

// ─── AUFLOCKERUNGSFAKTOREN (DIN 18300) ────────────────────────────
export const AUFLOCKERUNG = {
  bk_1_2: { faktor: 1.05, label: 'BK 1-2 (Oberboden)' },
  bk_3:   { faktor: 1.10, label: 'BK 3 (Sand/Kies)' },
  bk_4_5: { faktor: 1.22, label: 'BK 4-5 (Ton/Schluff)' },
  bk_6_7: { faktor: 1.37, label: 'BK 6-7 (Fels)' },
};

// ─── ERFAHRUNGSPREISE (Fallback) ──────────────────────────────────
export const ERFAHRUNGSPREISE = {
  geotextil_900_1200:      { preis: 1.80, einheit: 'm²', label: 'Geotextil 900-1200 g/m²' },
  pe_folie:                { preis: 0.30, einheit: 'm²', label: 'PE-Folie/Trennfolie' },
  beton_c20_25_klein:      { preis: 200.00, einheit: 'm³', label: 'Beton C20/25 Kleinmenge 1-2 m³' },
  beton_c20_25_lkw:        { preis: 120.00, einheit: 'm³', label: 'Beton C20/25 LKW 8 m³' },
  beton_pumpe:             { preis: 30.00, einheit: 'm³', label: 'Beton Pumpenzuschlag' },
  pvc_kg_dn110:            { preis: 4.50, einheit: 'm', label: 'PVC KG DN110' },
  pvc_kg_dn125:            { preis: 6.00, einheit: 'm', label: 'PVC KG DN125' },
  pvc_kg_dn160:            { preis: 9.50, einheit: 'm', label: 'PVC KG DN160' },
  pvc_kg_dn200:            { preis: 16.00, einheit: 'm', label: 'PVC KG DN200' },
  schachtabdeckung:        { preis: 180.00, einheit: 'St', label: 'Schachtabdeckung Typ A' },
  doppelstabmatte_h183:    { preis: 38.00, einheit: 'm', label: 'Doppelstabmatte H183' },
  bauzaun_miete:           { preis: 0.45, einheit: 'm/Wo', label: 'Bauzaun Miete' },
  dixi_miete:              { preis: 75.00, einheit: 'StWo', label: 'Dixi Miete' },
  wc_container_miete:      { preis: 1000.00, einheit: 'StMt', label: 'WC-Container Miete' },
  dixi_bringabhol:         { preis: 200.00, einheit: 'St', label: 'Dixi Bring/Abhol pauschal' },
};

// ─── GEWERK: GaLaBau ──────────────────────────────────────────────
export const GALABAU = {

  // ═══ §1 BAUSTELLENEINRICHTUNG ═══════════════════════════════════
  baustelleneinrichtung: {
    label: '§1 Baustelleneinrichtung',
    leistungen: {

      be_einrichten_galabau: {
        label: 'BE einrichten GaLaBau/Erdbau/Abbruch',
        Y: 1800, Z: 50, X_regel: null, einheit: 'psch',
        hinweis: '30h, Z=50 inkl. LKW/Tieflader/Container',
      },
      be_einrichten_sonstige: {
        label: 'BE einrichten sonstige Gewerke',
        Y: 600, Z: 10, X_regel: null, einheit: 'psch',
        hinweis: 'Trockenbau, Maler usw.',
      },
      be_raeumen: {
        label: 'Baustelle räumen GaLaBau',
        Y: 600, Z: 15, X_regel: null, einheit: 'psch',
        hinweis: '10h, Z=15',
      },
      be_vorhalten: {
        label: 'BE vorhalten',
        Y_per_tag: 10, Z: 30, X_regel: null,
        umrechnung: { StTag: 10, StWo: 50, StMt: 200 },
        AA_override: 750, // EUR/Monat alternative
        modus: 'vorhalten',
        hinweis: '10 min Kontrollgang/Tag, Z=30 deckt Container-Miete',
      },

      dixi_aufstellen: {
        label: 'Dixi aufstellen/räumen',
        Y: 120, Z: 100, X_regel: null, einheit: 'St',
        hinweis: 'Bring/Abhol pauschal, 200 EUR Gerät',
      },
      dixi_vorhalten: {
        label: 'Dixi vorhalten',
        Y: 0, Z: 0, AA_override: 75, einheit: 'StWo',
        modus: 'vorhalten',
        hinweis: 'Wochenmiete, AA Override gelb',
      },

      wc_aufstellen: {
        label: 'WC-Container aufstellen/anschließen',
        Y: 1200, Z: 50, X_regel: null, einheit: 'St',
        hinweis: '20h inkl. Anschließen',
      },
      wc_vorhalten: {
        label: 'WC-Container vorhalten',
        Y: 0, Z: 0, AA_override: 1000, einheit: 'StMt',
        modus: 'vorhalten',
        hinweis: '1000 EUR/Monat, AA Override gelb',
      },

      schutzzaun_herstellen: {
        label: 'Schutzzaun/Bauzaun herstellen',
        Y: 10, Z: 15, X_regel: null, einheit: 'm',
        hinweis: 'inkl. Anlieferung und Rückfahrt',
      },
      schutzzaun_versetzen: {
        label: 'Schutzzaun/Bauzaun versetzen',
        Y: 5, Z: 5, X_regel: null, einheit: 'm',
        hinweis: 'Umlagerung innerhalb Baustelle',
      },
      schutzzaun_vorhalten: {
        label: 'Schutzzaun vorhalten',
        Y: 0, Z: 0, AA_override: 0.45, einheit: 'mWo',
        modus: 'vorhalten',
        hinweis: 'Wochenmiete pro m',
      },

      tor_aufstellen: {
        label: 'Tor aufstellen/abbauen',
        Y: 45, Z: 30, X_regel: null, einheit: 'St',
        hinweis: 'Tore schwerer/teurer als Bauzaunfelder',
      },
      tor_vorhalten: {
        label: 'Tor vorhalten',
        Y: 0, Z: 0, AA_override: 35, einheit: 'StMt',
        modus: 'vorhalten',
        hinweis: 'Marktmiete ca. 35 EUR/Monat',
      },
    },
  },

  // ═══ §2 ERDARBEITEN ══════════════════════════════════════════════
  erdarbeiten: {
    label: '§2 Erdarbeiten',
    leistungen: {

      oberboden_abtragen: {
        label: 'Oberboden flächig abtragen (Großmaschine)',
        Y: 2, Z: 25, X_regel: null, einheit: 'm³',
        modifier_flaechig: { zusatz_min_m2_per_10cm: 0.5 },
        hinweis: 'Basis 2 min/m³, +0.5 min/m² je 10cm bei flächigem Abtrag',
      },
      aushub_grossmaschine: {
        label: 'Aushub Baugrube Großmaschine BK1-4',
        Y: 2, Z: 25, X_regel: null, einheit: 'm³',
        hinweis: '2 min/m³ mit Großbagger',
      },
      aushub_handarbeit: {
        label: 'Aushub Handarbeit BK1-4',
        Y_min: 240, Y_max: 360, Z: 0, X_regel: null, einheit: 'm³',
        hinweis: '240=offen, 360=Wurzelbereich. Z-Formel löschen.',
      },
      aushub_minibagger: {
        label: 'Aushub Minibagger',
        Y: 10, Z: 15, X_regel: null, einheit: 'm³',
        hinweis: 'Schmale Gräben, eingeschränkter Zugang',
      },
      einbau_minibagger: {
        label: 'Einbau Minibagger',
        Y: 10, Z: 15, X_regel: null, einheit: 'm³',
        hinweis: 'Verfüllung mit Minibagger',
      },
      einbau_grossmaschine: {
        label: 'Erdeinbau verdichten Großmaschine',
        Y: 2, Z: 25, X_regel: null, einheit: 'm³',
        modifier_verdichtung: { zusatz_min_per_schicht: 1, standard_schichtdicke_cm: 33.33 },
        hinweis: '2 min/m³ Basis + 1 min je Verdichtungsschicht (33cm)',
      },
      transport_innerhalb: {
        label: 'Transport Erdmassen innerhalb BS',
        Y: 3, Z: 25, X_regel: null, einheit: 'm³',
        hinweis: 'Zusatz +3 min/m³ für internen Transport',
      },
      planieren: {
        label: 'Planieren',
        Y: 0.5, Z: 25, X_regel: null, einheit: 'm²',
        hinweis: '0.5 min/m²',
      },
      verdichten: {
        label: 'Verdichten',
        Y: 0.5, Z: 25, X_regel: null, einheit: 'm²',
        hinweis: '0.5 min/m²',
      },
      planieren_verdichten_m3: {
        label: 'Planieren + Verdichten kombiniert',
        Y: 1, Z: 25, X_regel: null, einheit: 'm³',
      },
    },
  },

  // ═══ §3 SCHÜTTGÜTER ═════════════════════════════════════════════
  schuettgueter: {
    label: '§3 Schüttgüter',
    leistungen: {

      einbau_grossflaechig: {
        label: 'Schüttgut einbauen großflächig (>200m²)',
        Y: 3, Z: 25, X_regel: 'schuettgut_material', einheit: 'm³',
        modifier_verdichtung: { zusatz_min_per_schicht: 1, standard_schichtdicke_cm: 33.33 },
        schwelle_m2: 200,
        hinweis: '3 min/m³ + 1 min je Verdichtungsschicht, Z=25',
      },
      einbau_kleinmenge: {
        label: 'Schüttgut einbauen Kleinmenge (<200m²)',
        Y: 20, Z: 15, X_regel: 'schuettgut_material', einheit: 'm³',
        schwelle_m2: 200,
        hinweis: '20 min/m³, Hinterfüllungen, schmale Kiesstreifen',
      },
      // When unit is m², convert via: Y_m2 = 3 min/m² (approx for small areas)
      einbau_kleinmenge_m2: {
        label: 'Schüttgut einbauen Kleinmenge (m²)',
        Y: 3, Z: 15, X_regel: 'schuettgut_material', einheit: 'm²',
        hinweis: '3 min/m² als Alternative zu 20 min/m³',
      },
    },
  },

  // ═══ §4 PFLASTER, PLATTEN & BORDARBEITEN ═════════════════════════
  pflaster_bord: {
    label: '§4 Pflaster, Platten & Bordarbeiten',
    leistungen: {

      pflaster_standard: {
        label: 'Pflaster verlegen Standard 8cm',
        Y: 25, Z: 5, X_regel: 'pflaster_material', einheit: 'm²',
        nebenmaterial: ['bettung_splitt', 'fugenmaterial'],
        hinweis: 'Mindestwert 25 min/m², aufwändig +5 bis +15',
      },
      pflaster_aufwaendig: {
        label: 'Pflaster verlegen aufwändig',
        Y: 35, Z: 5, X_regel: 'pflaster_material', einheit: 'm²',
        nebenmaterial: ['bettung_splitt', 'fugenmaterial'],
        hinweis: 'Naturstein, Kleinsteinpflaster, Muster',
      },
      platten_verlegen: {
        label: 'Platten verlegen',
        Y: 20, Z: 5, X_regel: 'platten_material', einheit: 'm²',
        nebenmaterial: ['bettung_splitt'],
        hinweis: 'Betonplatten, Natursteinplatten',
      },

      bordstein_setzen: {
        label: 'Bordstein/Randstein setzen',
        Y: 15, Z: 5, einheit: 'lfm',
        nebenmaterial: ['rueckenbeton_einseitig'],
        X_formel: 'stein + rueckenbeton',
        hinweis: '15 min/lfm, 0.05 m³/lfm Rückenbeton × 200 = 10 EUR/lfm',
      },
      bordstein_fundament_rueckenstuetze: {
        label: 'Bordstein inkl. Fundament UND Rückenstütze',
        Y: 22, Z: 5, einheit: 'lfm',
        nebenmaterial: ['rueckenbeton_beidseitig'],
        X_formel: 'stein + fundament_beton',
        hinweis: '15 min + 7 min Aushub = 22 min/lfm, 0.10 m³/lfm × 200 = 20 EUR Beton',
      },
      tiefbord_setzen: {
        label: 'Tiefbord setzen',
        Y: 12, Z: 5, einheit: 'lfm',
        nebenmaterial: ['rueckenbeton_einseitig'],
        X_formel: 'stein + rueckenbeton',
        hinweis: '12 min/lfm, Rückenbeton wie Bordstein',
      },

      schneiden_pflaster_beton: {
        label: 'Schneiden Pflaster/Beton',
        Y_m2: 187, Z: 15, X_regel: null, einheit: 'm²',
        umrechnung_lfm: { 8: 14.96, 10: 18.70 }, // dicke_cm → min/lfm
        hinweis: '187 min/m² Nassschnitt, X IMMER leer',
      },
      schneiden_stahlbeton: {
        label: 'Schneiden Stahlbeton',
        Y_m2: 300, Z: 15, X_regel: null, einheit: 'm²',
        hinweis: '300 min/m², X IMMER leer',
      },
      schneiden_asphalt: {
        label: 'Schneiden Asphalt',
        Y_m2: 120, Z: 15, X_regel: null, einheit: 'm²',
        umrechnung_lfm: { 10: 12 }, // 120 × 0.10 = 12 min/lfm
        hinweis: '120 min/m², X IMMER leer',
      },
    },
  },

  // ═══ §5 BETON & ABBRUCH ═════════════════════════════════════════
  beton_abbruch: {
    label: '§5 Beton & Abbruch',
    leistungen: {

      betonieren_rein: {
        label: 'Betonieren rein (Lieferbeton)',
        Y: 30, Z: 25, einheit: 'm³',
        X_beton: { klein: 200, lkw: 150 }, // EUR/m³ (LKW inkl. Pumpe)
        hinweis: '30 min/m³, Pumpe immer bei LKW',
      },
      betonieren_inkl_aushub: {
        label: 'Betonieren inkl. Aushub',
        Y: 60, Z: 25, einheit: 'm³',
        modifier_fundamentstelle: { zusatz_min: 25 },
        X_beton: { klein: 200, lkw: 150 },
        hinweis: '60 min/m³ + 25 min je Fundamentstelle',
      },
      betonieren_inkl_schalung: {
        label: 'Betonieren inkl. Schalung',
        Y: 300, Z: 25, einheit: 'm³',
        modifier_fundamentstelle: { zusatz_min: 25 },
        X_beton: { klein: 200, lkw: 150 },
        hinweis: '300 min/m³ + 25 min je Stelle',
      },
      schalung: {
        label: 'Schalung herstellen',
        Y: 25, Z: 25, einheit: 'm²',
        X_regel: 'schalung_material',
        hinweis: '25 min/m² Standard',
      },
      schalung_sichtbeton: {
        label: 'Schalung Sichtbeton',
        Y: 45, Z: 40, einheit: 'm²', // 25+20 min, 25+15 EUR/h
        X_regel: 'schalung_material',
        hinweis: '+20 min/m², +15 EUR/h Z',
      },

      abbruch_mauerwerk: {
        label: 'Abbruch Mauerwerk',
        Y: 30, Z: 25, X_regel: null, einheit: 'm³',
      },
      abbruch_asphalt: {
        label: 'Abbruch Asphalt aufnehmen',
        Y: 15, Z: 25, X_regel: null, einheit: 'm³',
        hinweis: 'Asphalt ist FEST, nicht Erdmasse!',
      },
      abbruch_beton: {
        label: 'Abbruch Beton unbewehrt',
        Y: 45, Z: 25, X_regel: null, einheit: 'm³',
      },
      abbruch_stahlbeton: {
        label: 'Abbruch Stahlbeton',
        Y: 90, Z: 25, X_regel: null, einheit: 'm³',
      },
    },
  },

  // ═══ §5.6 SCHWERE BAUTEILE ══════════════════════════════════════
  schwere_bauteile: {
    label: '§5.6 Schwere Bauteile im Fundament',
    leistungen: {
      schacht_setzen: {
        label: 'Schacht setzen',
        Y: 150, Z: 25, einheit: 'St',
        X_formel: 'bauteil + beton',
        hinweis: '150 min/St',
      },
      doppelstabmatte: {
        label: 'Doppelstabmatte setzen',
        Y: 35, Z: 5, einheit: 'lfm',
        X_formel: 'bauteil + beton',
        hinweis: '35 min/lfm',
      },
      zaunpfosten: {
        label: 'Zaunpfosten setzen (im Fundament)',
        Y: 90, Z: 15, einheit: 'St',
        X_formel: 'bauteil + beton',
        hinweis: '90 min/St',
      },
      drehfluegeltuer: {
        label: 'Drehflügeltür/Tor setzen',
        Y: 300, Z: 25, einheit: 'St',
        X_formel: 'bauteil + beton',
        hinweis: '300 min/St',
      },
      rinne_im_beton: {
        label: 'Entwässerungsrinne im Beton',
        Y: 60, Z: 15, einheit: 'lfm',
        X_formel: 'bauteil + beton',
        hinweis: '60 min/lfm',
      },
    },
  },

  // ═══ §6 PFLANZEN & BÄUME ════════════════════════════════════════
  pflanzen: {
    label: '§6 Pflanzen & Bäume',
    leistungen: {
      baum_pflanzen: {
        label: 'Hochstamm pflanzen',
        Y: 120, Z: 15, einheit: 'St',
        X_regel: 'baum_material', // Baum + Substrat + Verankerung
        hinweis: '120 min/Baum (Grube separat §2)',
      },
      baum_liefern: {
        label: 'Baum liefern (nur Lieferung)',
        Y: 0, Z: 0, einheit: 'St',
        X_regel: 'material_nur',
        hinweis: 'Y=0, nur Materialpreis. Pflanzen = separate Position.',
      },
      hecke_pflanzen: {
        label: 'Heckenpflanze setzen',
        Y: 4, Z: 5, einheit: 'St',
        X_regel: 'pflanze_material',
        hinweis: '4 min/St',
      },
      strauch_pflanzen: {
        label: 'Strauch pflanzen',
        Y: 6, Z: 5, einheit: 'St',
        X_regel: 'pflanze_material',
        hinweis: '6 min/St',
      },
      rasen_saatbett: {
        label: 'Saatbett herstellen',
        Y: 1.5, Z: 5, X_regel: null, einheit: 'm²',
        hinweis: '1.5 min/m²',
      },
      rasen_einsaat: {
        label: 'Rasen ansäen',
        Y: 0.5, Z: 5, einheit: 'm²',
        X_regel: 'rasensaat_material',
        hinweis: '0.5 min/m²',
      },
      spielgeraet_aufbauen: {
        label: 'Spielgerät aufbauen',
        Y: 480, Z: 5, einheit: 'St', // 8h Standard, je nach Gerät anpassen
        X_regel: 'spielgeraet_material',
        hinweis: 'Z=5 (nicht Default 0.50!), 480 min (8h) Standard-Aufbauzeit pro Gerät',
      },
    },
  },

  // ═══ §PFLEGE (Runde 6 Edesheim) ═════════════════════════════════
  pflege: {
    label: '§Pflege (Fertigstellungs-/Entwicklungspflege)',
    leistungen: {
      waessern_pflanzung: {
        label: 'Wässern Pflanzung (25 AG)',
        Y: 2.0, Z: 15, einheit: 'm²',
        X_pro_m2: 0.5,
        hinweis: 'Tanklaster Z=15, 25 Arbeitsgänge',
      },
      waessern_rasen: {
        label: 'Wässern Rasen (Start)',
        Y: 0.5, Z: 10, einheit: 'm²',
        X_pro_m2: 0.2,
      },
      maehen: {
        label: 'Mähen Rasen (10 AG)',
        Y: 1.0, Z: 10, X_regel: null, einheit: 'm²',
        hinweis: 'Mäher Z=10-15',
      },
      duengen: {
        label: 'Düngen (1 AG)',
        Y: 0.3, Z: 5, einheit: 'm²',
        X_pro_m2: 0.4,
      },
      fertigstellungspflege: {
        label: 'Fertigstellungspflege (6 AG)',
        Y: 1.5, Z: 10, einheit: 'm²',
        X_pro_m2: 0.5,
      },
    },
  },
};

// ─── NU TRIGGER KEYWORDS (§0.7) ──────────────────────────────────
// Positions matching these → ALWAYS NU (M>0, Y=0, X=empty)
export const NU_TRIGGERS = [
  'fallschutzbelag',
  'fallschutz epdm',
  'fallschutz kautschuk',
  'fallschutz gummigranulat',
  'fahrbahnmarkierung',
  'markierung',
  'tuev', 'tüv',
  'tuev-pruefung', 'tüv-prüfung',
  'tuev-abnahme', 'tüv-abnahme',
  'sachverstaendig', 'sachverständig',
  'inspektion din 1176',
  'pruefung spielplatz', 'prüfung spielplatz',
  'spielplatzpruefung', 'spielplatzprüfung',
  // Asphalt CONSTRUCTION = NU (GaLaBau subcontracts asphalt paving)
  'asphaltdeckschicht herstell',
  'asphalttragschicht herstell',
  'asphaltbinderschicht',
  'schwarzdecke herstell',
  'walzasphalt',
  'gussasphalt',
];

// ─── VORHALTEN EINHEITEN (§0.9) ──────────────────────────────────
export const VORHALTEN_EINHEITEN = [
  'StWo', 'stwo', 'stWo',
  'mWo', 'mwo',
  'StMt', 'stmt', 'stMt',
  'StTag', 'sttag', 'stTag',
];

// ─── NEBENMATERIAL REZEPTE ────────────────────────────────────────
export const NEBENMATERIAL = {
  rueckenbeton_einseitig: {
    label: 'Rückenbeton einseitig',
    m3_per_lfm: 0.05,
    beton_preis_klein: 200, // EUR/m³
    eur_per_lfm: 10.00,
  },
  rueckenbeton_beidseitig: {
    label: 'Fundament + Rückenstütze (beidseitig)',
    m3_per_lfm: 0.10,
    beton_preis_klein: 200,
    eur_per_lfm: 20.00,
  },
  bettung_splitt: {
    label: 'Splitt-Bettung Pflaster',
    standard_dicke_cm: 4,
    // m³/m² = dicke_cm / 100
    // EUR/m² = m³/m² × dichte × preis/t
  },
  fugenmaterial: {
    label: 'Fugenmaterial',
    verbrauch_kg_m2: 8,
    // EUR/m² from price per tonne
  },
};

// ─── BETONPREISE ──────────────────────────────────────────────────
export const BETONPREISE = {
  kleinmenge: 200, // EUR/m³ (1-2 m³)
  lkw_basis: 120,  // EUR/m³ (8 m³)
  pumpe: 30,       // EUR/m³ Zuschlag
  lkw_inkl_pumpe: 150, // EUR/m³
  schwelle_m3: 3,  // <3 m³ = Kleinmenge
};

// ─── BORDSTEIN TYPPREISE (Erfahrungswerte) ────────────────────────
export const BORDSTEIN_PREISE = {
  'EF6/30':  3.50,
  'TB8/25':  4.50,
  'TB8/30':  5.50,
  'TB10/25': 6.50,
  'TB15/25': 8.00,
  'TB15/30': 9.50,
};

// ─── CONSISTENCY CHAINS (Runde 6) ─────────────────────────────────
// Within an LV, these must hold: bigger/harder → more expensive
export const CONSISTENCY_RULES = [
  { family: 'pflaster_dicke', rule: '12cm > 10cm > 8cm (EP)' },
  { family: 'bord', rule: 'Rundbord > Hochbord > Tiefbord (EP)' },
  { family: 'schuettgut', rule: 'höhere Festigkeit > niedrigere (EP)' },
  { family: 'bauteile_Y', rule: 'Tor > Schacht > Zaunpfosten > Rinne (min)' },
  { family: 'rohre', rule: 'größerer DN > kleinerer DN (EP)' },
  { family: 'baeume', rule: 'größerer StU > kleinerer StU (EP)' },
  { family: 'pflanzen', rule: 'Hochstamm > Strauch > Heckenpflanze (EP)' },
];

// ─── HELPER: Get all Gewerk data ──────────────────────────────────
export function getAllLeistungen() {
  const result = [];
  for (const [catKey, category] of Object.entries(GALABAU)) {
    for (const [key, leistung] of Object.entries(category.leistungen)) {
      result.push({
        id: `${catKey}.${key}`,
        category: catKey,
        categoryLabel: category.label,
        key,
        ...leistung,
      });
    }
  }
  return result;
}

// ─── HELPER: Find Leistung by ID ─────────────────────────────────
export function getLeistung(categoryKey, leistungKey) {
  const category = GALABAU[categoryKey];
  if (!category) return null;
  return category.leistungen[leistungKey] || null;
}
