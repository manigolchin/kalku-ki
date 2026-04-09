/**
 * SUPPLIER MATCHER — Match Angebot items to LV positions + compare suppliers
 *
 * Strategy: "Take cheapest supplier OVERALL" (per Lieferant total, not per position)
 * This is how real contractors buy — they commit to one Lieferant for a material group
 * because it simplifies logistics, gets volume discounts, and reduces delivery trips.
 */

import { getUnitConversion } from './unitConverter.js';
import { scanLangtext } from './langtextScanner.js';
import { log } from './logger.js';

// ─── MATERIAL CATEGORIES ──────────────────────────────────────────
// Group materials into categories for supplier comparison
const MATERIAL_GROUPS = {
  schotter_kies: {
    label: 'Schotter/Kies/Sand',
    keywords: ['schotter', 'kies', 'sand', 'sts', 'frostschutz', 'splitt', 'mineralgemisch',
               'schottertragschicht', 'brechsand', 'edelsplitt', 'rheinsand', 'füllsand',
               'recycling', 'rc-material', 'mineralbeton', 'fsts'],
  },
  bordsteine: {
    label: 'Bordsteine/Einfassungen',
    keywords: ['bord', 'bordstein', 'tiefbord', 'hochbord', 'rundbord', 'einfassung',
               'randstein', 'rasenkante', 'mähkante', 'betonbord'],
  },
  pflaster: {
    label: 'Pflaster/Platten',
    keywords: ['pflaster', 'verbundpflaster', 'betonpflaster', 'platte', 'gehwegplatte',
               'terrassenplatte', 'naturstein', 'kleinpflaster', 'betonsteinpflaster'],
  },
  beton: {
    label: 'Beton/Frischbeton',
    keywords: ['beton', 'frischbeton', 'transportbeton', 'c12', 'c16', 'c20', 'c25', 'c30',
               'estrich', 'magerbeton'],
  },
  pflanzen: {
    label: 'Pflanzen/Bäume',
    keywords: ['pflanze', 'baum', 'hochstamm', 'strauch', 'hecke', 'staude', 'bodendecker',
               'carpinus', 'quercus', 'acer', 'tilia', 'fraxinus', 'ligustrum', 'thuja',
               'rasen', 'rasensaat', 'rollrasen'],
  },
  spielgeraete: {
    label: 'Spielgeräte',
    keywords: ['spielgerät', 'klettergerät', 'schaukel', 'rutsche', 'wippe', 'seilbahn',
               'kletterturm', 'karussell', 'spielkombination', 'balancier', 'robinie'],
  },
  zaun: {
    label: 'Zaunbau',
    keywords: ['zaun', 'doppelstabmatte', 'stabgitter', 'pfosten', 'tor', 'drehflügel',
               'gartent', 'maschendraht', 'sichtschutz', 'zaunpfosten', 'einfahrtstor'],
  },
  rohre: {
    label: 'Rohre/Entwässerung',
    keywords: ['rohr', 'pvc', 'kg-rohr', 'dn', 'schacht', 'rinne', 'entwässerung',
               'drainage', 'sickerschacht', 'kontrollschacht', 'muldenrinne'],
  },
  asphalt_nu: {
    label: 'Asphalt (NU)',
    keywords: ['asphalt', 'deckschicht', 'tragschicht', 'binderschicht', 'schwarzdecke',
               'fräsen', 'walzen'],
  },
  fallschutz_nu: {
    label: 'Fallschutz (NU)',
    keywords: ['fallschutz', 'epdm', 'kautschuk', 'gummigranulat', 'fallschutzboden'],
  },
  sonstiges: {
    label: 'Sonstiges',
    keywords: [],
  },
};


/**
 * Identify which material group an Angebot item belongs to
 */
function classifyMaterialGroup(text) {
  const lower = text.toLowerCase();
  for (const [groupId, group] of Object.entries(MATERIAL_GROUPS)) {
    if (groupId === 'sonstiges') continue;
    if (group.keywords.some(kw => lower.includes(kw))) {
      return groupId;
    }
  }
  return 'sonstiges';
}


// ─── MATCH ANGEBOT ITEMS TO LV POSITIONS ──────────────────────────

/**
 * Match all Angebot items to LV positions
 * @param {Array} angebote - All extracted Angebote for this project
 * @param {Array} positions - All LV positions
 * @returns {Object} { matches, supplierGroups, bestPerGroup }
 */
export function matchAngeboteToLV(angebote, positions) {
  const allItems = [];
  const supplierGroups = {}; // groupId → { supplierId → { items, total } }

  // Collect all items from all Angebote and classify them
  for (const angebot of angebote) {
    for (const item of angebot.positionen) {
      // Skip alternative positions — only use main (Haupt) positions for comparison
      if (item.ist_alternative) continue;
      const group = classifyMaterialGroup(item.bezeichnung);
      const enriched = {
        ...item,
        lieferant: angebot.lieferant,
        angebot_id: angebot.id,
        angebot_datum: angebot.datum,
        material_group: group,
        matched_positions: [],
      };
      allItems.push(enriched);

      // Build supplier groups
      if (!supplierGroups[group]) supplierGroups[group] = {};
      if (!supplierGroups[group][angebot.lieferant]) {
        supplierGroups[group][angebot.lieferant] = {
          lieferant: angebot.lieferant,
          angebot_id: angebot.id,
          items: [],
          total_gp: 0,
        };
      }
      supplierGroups[group][angebot.lieferant].items.push(enriched);
    }
  }

  // Match items to LV positions
  const matches = new Map(); // posOz → [{ item, score }]

  for (const pos of positions) {
    if (pos.is_header) continue;

    const posText = ((pos.short_text || '') + ' ' + (pos.long_text || '')).toLowerCase();
    const posGroup = classifyMaterialGroup(pos.short_text || '');

    for (const item of allItems) {
      const score = calculateMatchScore(item, pos, posText, posGroup);
      if (score > 0.3) {
        if (!matches.has(pos.oz)) matches.set(pos.oz, []);
        matches.get(pos.oz).push({
          item,
          score,
          preis: item.preis_effektiv,
          einheit: item.einheit,
          lieferant: item.lieferant,
        });
        item.matched_positions.push(pos.oz);
      }
    }

    // Sort matches by score descending
    if (matches.has(pos.oz)) {
      matches.get(pos.oz).sort((a, b) => b.score - a.score);
    }
  }

  // Calculate supplier totals per group
  for (const [, suppliers] of Object.entries(supplierGroups)) {
    for (const [, suppData] of Object.entries(suppliers)) {
      let total = 0;
      for (const item of suppData.items) {
        // Find best-matching LV position for quantity
        for (const posOz of item.matched_positions) {
          const pos = positions.find(p => p.oz === posOz);
          if (pos) {
            total += item.preis_effektiv * (pos.quantity != null ? pos.quantity : 1);
          }
        }
      }
      suppData.total_gp = Math.round(total * 100) / 100;
    }
  }

  return { matches, supplierGroups, allItems };
}


/**
 * Calculate match score between an Angebot item and an LV position
 */
function calculateMatchScore(item, pos, posText, posGroup) {
  let score = 0;
  const itemText = item.bezeichnung.toLowerCase();
  const itemWords = itemText.split(/\s+/).filter(w => w.length > 2);

  // Same material group = baseline match
  if (item.material_group === posGroup && posGroup !== 'sonstiges') {
    score += 0.3;
  }

  // Word overlap
  let matchedWords = 0;
  for (const word of itemWords) {
    if (posText.includes(word)) matchedWords++;
  }
  if (itemWords.length > 0) {
    score += (matchedWords / itemWords.length) * 0.5;
  }

  // Position number match (for NU Angebote)
  if (item.pos_nr && pos.oz) {
    const itemNr = item.pos_nr.replace(/\s/g, '');
    const posNr = pos.oz.replace(/\s/g, '');
    if (itemNr === posNr || posNr.endsWith(itemNr) || itemNr.endsWith(posNr)) {
      score += 0.4;
    }
  }

  // Unit compatibility bonus
  if (item.einheit && pos.unit) {
    const iu = normalizeUnit(item.einheit);
    const pu = normalizeUnit(pos.unit);
    if (iu === pu) score += 0.1;
  }

  // Specific material name matches
  const specifics = [
    [/tb\s*8\/25/i, /tb\s*8\/25/i],
    [/tb\s*8\/30/i, /tb\s*8\/30/i],
    [/tb\s*10\/25/i, /tb\s*10\/25/i],
    [/ef\s*6\/30/i, /ef\s*6\/30/i],
    [/sts\s*0\/32/i, /sts\s*0\/32|schottertragschicht\s*0\/32/i],
    [/sts\s*0\/45/i, /sts\s*0\/45|schottertragschicht\s*0\/45/i],
    [/c\s*20\/25/i, /c\s*20\/25/i],
    [/c\s*12\/15/i, /c\s*12\/15/i],
    [/dn\s*\d+/i, /dn\s*\d+/i],
  ];

  for (const [itemPattern, posPattern] of specifics) {
    const itemMatch = itemText.match(itemPattern);
    const posMatch = posText.match(posPattern);
    if (itemMatch && posMatch && itemMatch[0] === posMatch[0]) {
      score += 0.3;
    }
  }

  return Math.min(score, 1.0);
}


// ─── SELECT BEST SUPPLIERS (OVERALL CHEAPEST PER GROUP) ───────────

/**
 * For each material group, select the cheapest supplier OVERALL
 * NOT per-position, but per-group total GP.
 *
 * @param {Object} supplierGroups - from matchAngeboteToLV
 * @param {Array} positions - LV positions
 * @returns {Object} bestSuppliers: { groupId → { lieferant, total_gp, items } }
 */
export function selectBestSuppliers(supplierGroups) {
  const bestSuppliers = {};
  const comparison = {};

  for (const [groupId, suppliers] of Object.entries(supplierGroups)) {
    const supplierList = Object.values(suppliers);
    if (supplierList.length === 0) continue;

    // Sort by total GP ascending (cheapest first)
    supplierList.sort((a, b) => a.total_gp - b.total_gp);

    bestSuppliers[groupId] = {
      ...supplierList[0],
      selected: true,
    };

    comparison[groupId] = {
      label: MATERIAL_GROUPS[groupId]?.label || groupId,
      suppliers: supplierList.map((s, i) => ({
        lieferant: s.lieferant,
        total_gp: s.total_gp,
        item_count: s.items.length,
        is_cheapest: i === 0,
        differenz_eur: i === 0 ? 0 : s.total_gp - supplierList[0].total_gp,
        differenz_pct: i === 0 ? 0 : supplierList[0].total_gp > 0
          ? Math.round((s.total_gp - supplierList[0].total_gp) / supplierList[0].total_gp * 100)
          : 0,
      })),
    };
  }

  return { bestSuppliers, comparison };
}


// ─── BUILD PRICE MAP FOR CALCULATOR ───────────────────────────────

/**
 * Build the priceMap that autoCalc.js expects,
 * using the best (cheapest overall) supplier per material group.
 *
 * Handles: unit conversion (€/t→€/m²), Frachtkosten distribution, Mindermengenzuschlag
 *
 * @param {Object} bestSuppliers - from selectBestSuppliers
 * @param {Map} matches - from matchAngeboteToLV
 * @param {Array} positions - LV positions
 * @param {Array} angebote - original Angebote (for Fracht access)
 * @returns {Object} priceMap: { posOz → { hauptmaterial_preis, nu_preis, quelle } }
 */
export function buildPriceMap(bestSuppliers, matches, positions, angebote = []) {
  const priceMap = {};
  log('supplierMatch', '═══ PRICEMAP BUILDING ═══', {
    suppliers: Object.keys(bestSuppliers).length,
    matchedPositions: matches.size,
    angebote: angebote.length,
  });

  // ─── Pre-compute Fracht % per supplier ───────────────────────
  const frachtPct = {};
  for (const angebot of angebote) {
    const fracht = angebot.fracht;
    if (!fracht) continue;

    // Calculate total material value for proportional distribution
    let totalMaterialValue = 0;
    for (const item of (angebot.positionen || [])) {
      totalMaterialValue += item.preis_effektiv || item.preis_basis || 0;
    }

    if (fracht.pauschal_eur > 0 && totalMaterialValue > 0) {
      frachtPct[angebot.lieferant] = {
        pct: fracht.pauschal_eur / totalMaterialValue,
        pauschal: fracht.pauschal_eur,
        frei_ab: fracht.frei_ab_eur || null,
      };
    }
    if (fracht.per_t_eur > 0) {
      frachtPct[angebot.lieferant] = {
        ...(frachtPct[angebot.lieferant] || {}),
        per_t: fracht.per_t_eur,
      };
    }
  }

  for (const pos of positions) {
    if (pos.is_header) continue;
    if (!matches.has(pos.oz)) continue;

    const posMatches = matches.get(pos.oz);

    // Find the best match FROM the selected supplier for this material group
    const posGroup = classifyMaterialGroup(pos.short_text || '');
    const selectedSupplier = bestSuppliers[posGroup];

    if (!selectedSupplier) continue;

    // Find match from the selected supplier
    const supplierMatch = posMatches.find(m =>
      m.lieferant === selectedSupplier.lieferant && m.score > 0.3
    );

    if (!supplierMatch) {
      // Fallback: best match from any supplier
      const bestMatch = posMatches[0];
      if (bestMatch && bestMatch.score > 0.5) {
        const converted = convertMatchPrice(bestMatch, pos, frachtPct);
        priceMap[pos.oz] = {
          hauptmaterial_preis: converted.preis,
          nu_preis: 0,
          quelle: `${bestMatch.lieferant} (bester Match)${converted.hinweis}`,
          einheit_angebot: bestMatch.einheit,
        };
      }
      continue;
    }

    // Convert price (unit conversion + Fracht + Mindermenge)
    const converted = convertMatchPrice(supplierMatch, pos, frachtPct);

    // Determine if this is NU (M column) or Material (X column)
    const isNU = selectedSupplier.items.some(si =>
      si.pos_nr && si.bezeichnung.toLowerCase().match(/komplett|nu|montage|verlegen|einbau/)
    );

    if (isNU) {
      priceMap[pos.oz] = {
        hauptmaterial_preis: 0,
        nu_preis: converted.preis,
        quelle: `${selectedSupplier.lieferant} (NU)${converted.hinweis}`,
        einheit_angebot: supplierMatch.einheit,
      };
    } else {
      priceMap[pos.oz] = {
        hauptmaterial_preis: converted.preis,
        nu_preis: 0,
        quelle: `${selectedSupplier.lieferant}${converted.hinweis}`,
        einheit_angebot: supplierMatch.einheit,
      };
    }
  }

  // Log all assigned prices
  const pmEntries = Object.entries(priceMap);
  log('supplierMatch', `PriceMap fertig: ${pmEntries.length} Preise zugeordnet`);
  for (const [oz, pm] of pmEntries) {
    log('supplierMatch', `  ${oz}: X=${pm.hauptmaterial_preis || 0} M=${pm.nu_preis || 0} | ${pm.quelle}`);
  }

  return priceMap;
}


/**
 * Convert an Angebot match price to the LV unit, applying:
 * 1. Unit conversion (€/t → €/m², €/m³ → €/m², etc.)
 * 2. Fracht distribution (proportional)
 * 3. Mindermengenzuschlag
 */
function convertMatchPrice(match, pos, frachtPct) {
  let preis = match.preis;
  const hinweise = [];

  // ─── 1. Unit conversion ──────────────────────────────────────
  if (match.einheit && pos.unit) {
    const scan = scanLangtext(pos.long_text || '', pos.short_text || '');
    const materialText = (pos.short_text || '') + ' ' + (match.item?.bezeichnung || '');
    const conv = getUnitConversion(match.einheit, pos.unit, scan.dimensions, materialText);

    if (conv && conv.conversionNeeded && !conv.error) {
      preis = conv.convert(preis);
      hinweise.push(conv.formel);
    } else if (conv?.error) {
      hinweise.push(`⚠ ${conv.error}`);
    }
  }

  // ─── 2. Mindermengenzuschlag ─────────────────────────────────
  const item = match.item || {};
  if (item.mindermenge?.schwelle && item.mindermenge?.zuschlag_eur) {
    const qty = pos.quantity || 0;
    if (qty > 0 && qty < item.mindermenge.schwelle) {
      const zuschlag_per_unit = item.mindermenge.zuschlag_eur / qty;
      preis += zuschlag_per_unit;
      hinweise.push(`+Minderm. ${item.mindermenge.zuschlag_eur}€ (<${item.mindermenge.schwelle})`);
    }
  }

  // ─── 3. Fracht distribution ──────────────────────────────────
  const fracht = frachtPct[match.lieferant];
  if (fracht) {
    // Check frei_ab threshold
    const totalOrderValue = (pos.quantity || 1) * preis;
    const frachtFree = fracht.frei_ab && totalOrderValue >= fracht.frei_ab;

    if (!frachtFree && fracht.pct) {
      preis = Math.round((preis * (1 + fracht.pct)) * 100) / 100;
      hinweise.push(`+Fracht ${Math.round(fracht.pct * 100)}%`);
    }

    // Per-tonne Fracht (only for t-based prices before conversion)
    if (fracht.per_t && match.einheit && normalizeUnit(match.einheit) === 't') {
      // per_t was already in the base price if it's still in tonnes,
      // but if converted, we need to factor it into the original
      // It's already included in preis_effektiv via Zuschläge extraction
    }
  }

  preis = Math.round(preis * 100) / 100;

  return {
    preis,
    hinweis: hinweise.length > 0 ? ` [${hinweise.join(', ')}]` : '',
  };
}


/**
 * Get a summary of all supplier comparisons for display
 */
export function getSupplierSummary(comparison) {
  let totalErsparnis = 0;
  let totalBeste = 0;
  let totalTeuerste = 0;

  for (const group of Object.values(comparison)) {
    if (group.suppliers.length < 1) continue;
    const cheapest = group.suppliers[0].total_gp;
    const most = group.suppliers[group.suppliers.length - 1].total_gp;
    totalBeste += cheapest;
    totalTeuerste += most;
  }

  totalErsparnis = totalTeuerste - totalBeste;

  return {
    totalBeste: Math.round(totalBeste * 100) / 100,
    totalTeuerste: Math.round(totalTeuerste * 100) / 100,
    ersparnis: Math.round(totalErsparnis * 100) / 100,
    ersparnis_pct: totalTeuerste > 0
      ? Math.round(totalErsparnis / totalTeuerste * 100)
      : 0,
  };
}


// ─── HELPERS ──────────────────────────────────────────────────────

function normalizeUnit(unit) {
  return (unit || '').toLowerCase()
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/stk|stck|stück/g, 'st')
    .replace(/lfdm|lfd\.?\s*m/g, 'lfm')
    .trim();
}
