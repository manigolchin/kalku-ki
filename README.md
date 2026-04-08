<p align="center">
  <img src="public/favicon.svg" alt="KALKU-KI Logo" width="64" height="64" />
</p>

<h1 align="center">KALKU-KI</h1>

<p align="center">
  <strong>KI-gestützter Baukalkulations-Assistent</strong><br/>
  Einheitspreiskalkulation &middot; GAEB-Import &middot; VOB-Nachträge &middot; Dokumentenanalyse
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

---

## Was ist KALKU-KI?

KALKU-KI ist eine Web-Applikation für Bauunternehmer, Kalkulatoren und Bauleiter. Sie vereint KI-Chat, Projektverwaltung, Dokumentenanalyse und Kalkulationstools in einer modernen Oberfläche — optimiert für die deutsche Bauwirtschaft.

## Features

### KALKU-Chat
KI-Assistent spezialisiert auf Baukalkulation. Beantwortet Fragen zu Einheitspreisen, Aufwandswerten, Materialkosten und VOB-Regelungen. Unterstützt Prompt-Vorlagen für häufige Kalkulationsaufgaben.

### Projekte
Projektverwaltung mit GAEB-Import (`.x83`, `.x84`, `.d83`, `.p83`, `.xml`). Positionen werden automatisch geparst und mit Kostenaufschlüsselung (Lohn, Material, Geräte, Nachunternehmer) dargestellt. Excel-Export inklusive.

### Dokumente
Drag & Drop Upload für LV-Dateien, Angebote und Aufmaße. Automatische Dokumententyp-Erkennung und KI-gestützte Analyse. Unterstützt GAEB/XML, PDF, DOCX und Excel.

### Kalkulator
Drei spezialisierte Rechner:
- **EP-Kalkulation (EFB 221)** — Einheitspreis nach Zuschlagskalkulation mit Lohn, Material, Geräte und Nachunternehmer
- **Massenermittlung** — Mengenberechnung für verschiedene Gewerke
- **VOB §2 Nachtrag** — Nachtragsberechnung bei Mengenänderungen nach VOB/B

### Einstellungen
Konfigurierbare Kalkulationsparameter: Mittellohn (regional), Zuschlagssätze (BGK, AGK, W+G), Gewerk-Auswahl (GaLaBau, Tiefbau, Hochbau) und API-Schlüssel für KI-Funktionen.

## Tech Stack

| Kategorie | Technologie |
|-----------|------------|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Charts | Recharts |
| Datei-Parsing | GAEB/XML-Parser, pdf.js, mammoth, xlsx |
| State | localStorage mit Custom Hooks |
| Deployment | Docker + Nginx |

## Schnellstart

### Voraussetzungen

- [Node.js](https://nodejs.org/) >= 20
- [Docker](https://www.docker.com/) (optional)

### Lokal starten

```bash
git clone https://github.com/manigolchin/kalku-ki.git
cd kalku-ki
npm install
npm run dev
```

Die App läuft unter `http://localhost:5173`.

### Mit Docker

```bash
git clone https://github.com/manigolchin/kalku-ki.git
cd kalku-ki
docker compose up --build -d
```

Die App läuft unter `http://localhost:3000`.

Stoppen:

```bash
docker compose down
```

## Projektstruktur

```
kalku-ki/
├── public/                  # Statische Assets (Favicon, Icons)
├── src/
│   ├── components/          # Gemeinsame UI-Komponenten
│   │   ├── ContextBar.jsx
│   │   ├── KalkulationTable.jsx
│   │   └── Sidebar.jsx
│   ├── hooks/               # Custom React Hooks
│   │   ├── useKalkuAI.js    # KI-Chat Integration
│   │   ├── useLocalStorage.js
│   │   └── useSettings.js   # Kalkulationsparameter
│   ├── modules/
│   │   ├── Chat/            # KI-Chat Modul
│   │   ├── Dokumente/       # Dokumenten-Upload & Analyse
│   │   ├── Einstellungen/   # Einstellungen & Konfiguration
│   │   ├── Kalkulator/      # EFB 221, Massen, Nachträge
│   │   └── Projekte/        # Projektverwaltung & GAEB-Import
│   ├── utils/               # Hilfs-Funktionen
│   │   ├── gaebParser.js    # GAEB/XML Parser
│   │   ├── kalkulation.js   # Kalkulationslogik
│   │   ├── marktpreise.js   # Marktpreisdatenbank
│   │   ├── projectCalc.js   # Projektberechnungen
│   │   ├── projectStore.js  # Projektspeicherung
│   │   └── excelExport.js   # Excel-Export
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── Dockerfile               # Multi-Stage Build (Node + Nginx)
├── docker-compose.yml
├── nginx.conf               # SPA-Routing, Gzip, Caching
├── package.json
└── vite.config.js
```

## KI-Konfiguration

KALKU-KI nutzt eine externe KI-API für den Chat-Assistenten. Den API-Schlüssel kannst du unter **Einstellungen** in der App hinterlegen. Die Einstellungen werden lokal im Browser gespeichert.

## Lizenz

Dieses Projekt ist privat. Alle Rechte vorbehalten.
