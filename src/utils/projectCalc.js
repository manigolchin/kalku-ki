/**
 * Kalku Kalkulation - Core Calculation Engine
 * Ported from Python backend. Implements exact formulas from Excel-based templates.
 * All cost calculations for positions and project summaries.
 */

// ---------------------------------------------------------------------------
// Position Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate all cost components for a single position.
 *
 * @param {number} quantity - Menge
 * @param {number} materialCost - Stoffe EK per unit
 * @param {number} timeMinutes - Zeit in min per unit
 * @param {number} nuCost - Nachunternehmer EK per unit
 * @param {Object} params - CalcParams object
 * @returns {Object} All calculated values
 */
export function calculatePosition(quantity, materialCost, timeMinutes, nuCost, params) {
  // Step 1: Adjusted time
  const actualTime = timeMinutes + (timeMinutes / 100 * params.zeitabzug);

  // Step 2: Equipment EP
  const epGeraete = (actualTime / 60) * params.geraete_stundensatz;

  // Step 3: Labor EP
  const epLohn = (actualTime / 60) * params.verrechnungslohn;

  // Step 4: Material EP with markup
  const epMaterial = materialCost * (1 + params.material_zuschlag);

  // Step 5: Subcontractor EP with markup
  const epNu = nuCost * (1 + params.nu_zuschlag);

  // Step 6: Total EP
  const ep = epGeraete + epLohn + epMaterial + epNu;

  // Step 7: Total GP
  const gp = quantity * ep;

  // GP breakdown
  const gpLohn = quantity * epLohn;
  const gpMaterial = quantity * epMaterial;
  const gpGeraete = quantity * epGeraete;
  const gpNu = quantity * epNu;

  // Time planning
  const hoursPerUnit = actualTime / 60;
  const hoursTotal = actualTime * quantity / 60;
  const daysTotal = (params.tagesstunden > 0 && params.personaleinsatz > 0)
    ? hoursTotal / params.tagesstunden / params.personaleinsatz
    : 0;

  // Productivity
  const outputPerHour = actualTime > 0 ? 60 / actualTime : 0;
  const outputPerDay = outputPerHour * params.tagesstunden;

  return {
    ep: round2(ep),
    gp: round2(gp),
    ep_lohn: round2(epLohn),
    ep_material: round2(epMaterial),
    ep_geraete: round2(epGeraete),
    ep_nu: round2(epNu),
    gp_lohn: round2(gpLohn),
    gp_material: round2(gpMaterial),
    gp_geraete: round2(gpGeraete),
    gp_nu: round2(gpNu),
    actual_time: round2(actualTime),
    hours_per_unit: round4(hoursPerUnit),
    hours_total: round2(hoursTotal),
    days_total: round2(daysTotal),
    output_per_hour: round2(outputPerHour),
    output_per_day: round2(outputPerDay),
  };
}

// ---------------------------------------------------------------------------
// Enrich Position (attach calculated fields to position data)
// ---------------------------------------------------------------------------

/**
 * Enrich a position with all calculated values.
 */
export function enrichPosition(pos, params) {
  if (pos.is_header) {
    return {
      ...pos,
      ep: 0, gp: 0,
      ep_lohn: 0, ep_material: 0, ep_geraete: 0, ep_nu: 0,
      gp_lohn: 0, gp_material: 0, gp_geraete: 0, gp_nu: 0,
      actual_time: 0, hours_per_unit: 0, hours_total: 0,
      days_total: 0, output_per_hour: 0, output_per_day: 0,
    };
  }

  const calc = calculatePosition(
    pos.quantity || 0,
    pos.material_cost || 0,
    pos.time_minutes || 0,
    pos.nu_cost || 0,
    params,
  );

  return { ...pos, ...calc };
}

// ---------------------------------------------------------------------------
// Project Summary Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate project-level summary.
 *
 * @param {Array} positions - Array of enriched positions (with gp_*, hours_total, days_total)
 * @param {Object} params - CalcParams
 * @returns {Object} Summary with netto, mwst, brutto, breakdown, totals
 */
export function calculateProjectSummary(positions, params) {
  const dataPositions = positions.filter((p) => !p.is_header);

  if (dataPositions.length === 0) {
    return {
      netto: 0, mwst_amount: 0, brutto: 0,
      breakdown: {
        lohn: { ek: 0, zuschlag_pct: 0, vk: 0, differenz: 0 },
        stoffe: { ek: 0, zuschlag_pct: 0, vk: 0, differenz: 0 },
        geraete: { ek: 0, zuschlag_pct: 0, vk: 0, differenz: 0 },
        nu: { ek: 0, zuschlag_pct: 0, vk: 0, differenz: 0 },
      },
      total_hours: 0, total_days: 0, ueberschuss: 0,
    };
  }

  // Sum GP components
  let totalGpLohn = 0, totalGpMaterial = 0, totalGpGeraete = 0, totalGpNu = 0;
  let totalHours = 0, totalDays = 0;

  for (const p of dataPositions) {
    totalGpLohn += p.gp_lohn || 0;
    totalGpMaterial += p.gp_material || 0;
    totalGpGeraete += p.gp_geraete || 0;
    totalGpNu += p.gp_nu || 0;
    totalHours += p.hours_total || 0;
    totalDays += p.days_total || 0;
  }

  const netto = totalGpLohn + totalGpMaterial + totalGpGeraete + totalGpNu;

  // Labor breakdown
  const lohnEk = params.mittellohn * totalHours;
  const lohnZuschlag = params.mittellohn > 0
    ? ((params.verrechnungslohn / params.mittellohn) - 1) * 100
    : 0;

  // Material breakdown
  const stoffeEk = totalGpMaterial > 0 ? totalGpMaterial / (1 + params.material_zuschlag) : 0;

  // Equipment breakdown
  const geraeteEk = totalGpGeraete > 0 ? totalGpGeraete / (1 + params.geraete_zuschlag_pct) : 0;

  // NU breakdown
  const nuEk = totalGpNu > 0 ? totalGpNu / (1 + params.nu_zuschlag) : 0;

  return {
    netto: round2(netto),
    mwst_amount: round2(netto * params.mwst),
    brutto: round2(netto * (1 + params.mwst)),
    breakdown: {
      lohn: {
        ek: round2(lohnEk),
        zuschlag_pct: round1(lohnZuschlag),
        vk: round2(totalGpLohn),
        differenz: round2(totalGpLohn - lohnEk),
      },
      stoffe: {
        ek: round2(stoffeEk),
        zuschlag_pct: round1(params.material_zuschlag * 100),
        vk: round2(totalGpMaterial),
        differenz: round2(totalGpMaterial - stoffeEk),
      },
      geraete: {
        ek: round2(geraeteEk),
        zuschlag_pct: round1(params.geraete_zuschlag_pct * 100),
        vk: round2(totalGpGeraete),
        differenz: round2(totalGpGeraete - geraeteEk),
      },
      nu: {
        ek: round2(nuEk),
        zuschlag_pct: round1(params.nu_zuschlag * 100),
        vk: round2(totalGpNu),
        differenz: round2(totalGpNu - nuEk),
      },
    },
    total_hours: round2(totalHours),
    total_days: round2(totalDays),
    ueberschuss: round2(
      (totalGpLohn - lohnEk) +
      (totalGpMaterial - stoffeEk) +
      (totalGpGeraete - geraeteEk) +
      (totalGpNu - nuEk)
    ),
  };
}

// ---------------------------------------------------------------------------
// Excel Export
// ---------------------------------------------------------------------------

/**
 * Export project data to Excel using xlsx library.
 */
export function exportProjectToExcel(project, enrichedPositions, summary) {
  // Dynamic import to avoid loading xlsx upfront
  return import('xlsx').then(({ utils, writeFile }) => {
    const wb = utils.book_new();

    // Summary sheet
    const summaryData = [
      ['KALKULATION'],
      [],
      ['BV:', project.name],
      ['AG:', project.client],
      ['Leistung:', project.service],
      ['Vergabenr.:', project.tender_number],
      ['Abgabe:', project.deadline],
      ['Bieter:', project.bidder],
      [],
      ['ZUSAMMENFASSUNG'],
      ['Netto:', summary.netto],
      [`MwSt (${(project.mwst * 100).toFixed(0)}%):`, summary.mwst_amount],
      ['Brutto:', summary.brutto],
      [],
      ['Kostenart', 'EK', 'Zuschlag %', 'VK', 'Differenz'],
      ['Lohn', summary.breakdown.lohn.ek, summary.breakdown.lohn.zuschlag_pct, summary.breakdown.lohn.vk, summary.breakdown.lohn.differenz],
      ['Stoffe', summary.breakdown.stoffe.ek, summary.breakdown.stoffe.zuschlag_pct, summary.breakdown.stoffe.vk, summary.breakdown.stoffe.differenz],
      ['Geraete', summary.breakdown.geraete.ek, summary.breakdown.geraete.zuschlag_pct, summary.breakdown.geraete.vk, summary.breakdown.geraete.differenz],
      ['Nachunternehmer', summary.breakdown.nu.ek, summary.breakdown.nu.zuschlag_pct, summary.breakdown.nu.vk, summary.breakdown.nu.differenz],
      [],
      ['Ueberschuss:', summary.ueberschuss],
      ['Gesamtstunden:', summary.total_hours],
      ['Gesamttage:', summary.total_days],
    ];

    const wsSummary = utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    utils.book_append_sheet(wb, wsSummary, 'Zusammenfassung');

    // Positions sheet
    const posHeaders = ['Pos', 'Bezeichnung', 'Menge', 'Einheit', 'Stoffe EK', 'Zeit (min)', 'NU EK', 'EP Lohn', 'EP Stoffe', 'EP Geraete', 'EP NU', 'EP', 'GP'];
    const posRows = enrichedPositions.map((p) => {
      if (p.is_header) {
        return [p.oz, p.short_text, '', '', '', '', '', '', '', '', '', '', ''];
      }
      return [
        p.oz, p.short_text, p.quantity, p.unit,
        p.material_cost, p.time_minutes, p.nu_cost,
        p.ep_lohn, p.ep_material, p.ep_geraete, p.ep_nu,
        p.ep, p.gp,
      ];
    });

    // Add total row
    posRows.push(['', 'SUMME', '', '', '', '', '', '', '', '', '', '', summary.netto]);

    const wsPositions = utils.aoa_to_sheet([posHeaders, ...posRows]);
    wsPositions['!cols'] = [
      { wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 8 },
      { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 16 },
    ];
    utils.book_append_sheet(wb, wsPositions, 'Positionen');

    // Generate filename
    const safeName = (project.name || 'Projekt').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `Kalkulation_${safeName}_${date}.xlsx`;

    writeFile(wb, filename);
    return filename;
  });
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

const currencyFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const numberFmt3 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 3, maximumFractionDigits: 3,
});

export const fmt = {
  currency: (v) => currencyFmt.format(v || 0),
  number: (v) => numberFmt.format(v || 0),
  number3: (v) => numberFmt3.format(v || 0),
};

// ---------------------------------------------------------------------------
// Rounding Helpers
// ---------------------------------------------------------------------------

function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function round4(v) { return Math.round((v + Number.EPSILON) * 10000) / 10000; }
function round1(v) { return Math.round((v + Number.EPSILON) * 10) / 10; }
