/**
 * KALKU-KI GAEB Parser
 * Supports:
 * - GAEB DA XML 3.x (.x83, .x84, .xml) — namespace-aware XML parsing
 * - GAEB 2000 tagged (.d83, .p83) — #begin[...] / #end[...] format
 * - GAEB 83 fixed-width (.d83, .p83) — Satzart-based ASCII (80 chars/line)
 */

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Parse a GAEB file (XML or ASCII) and extract all positions.
 * @param {string} content - File content as string
 * @param {string} [fileName] - Optional filename for format detection
 * @returns {Array<{oz, text, longText, qty, unit, section, isHeader}>}
 */
export function parseGAEB(content, fileName) {
  if (!content || typeof content !== 'string') {
    throw new Error('Kein gültiger Inhalt übergeben.');
  }

  const trimmed = content.trim();

  // Detect format
  if (isXmlFormat(trimmed)) {
    return parseGaebXml(trimmed);
  }
  if (isGaeb2000Tagged(trimmed)) {
    return parseGaeb2000Tagged(trimmed);
  }
  if (isD83Format(trimmed, fileName)) {
    return parseD83Content(trimmed);
  }

  // Fallback: try XML
  try {
    return parseGaebXml(trimmed);
  } catch {
    throw new Error(
      'Unbekanntes GAEB-Format. Unterstützt: GAEB DA XML 3.x, GAEB 2000, GAEB 83 ASCII.'
    );
  }
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

function isXmlFormat(content) {
  return content.startsWith('<?xml') || content.startsWith('<GAEB') || content.startsWith('<gaeb');
}

function isGaeb2000Tagged(content) {
  return content.substring(0, 500).includes('#begin[GAEB]');
}

function isD83Format(content, fileName) {
  // Extension-based detection
  if (fileName) {
    const ext = fileName.toLowerCase();
    if (ext.endsWith('.d83') || ext.endsWith('.p83')) {
      return !isXmlFormat(content) && !isGaeb2000Tagged(content);
    }
  }
  // Content-based detection
  if (content.substring(0, 2) === '00' || content.substring(0, 2) === 'T0') return true;
  const lines = content.split('\n').slice(0, 50);
  let indicators = 0;
  for (const line of lines) {
    if (line.length < 2) continue;
    const sa = line.substring(0, 2);
    if (['T0', 'T1', 'T2', '00', '11', '12', '20', '21', '25', '26', '99'].includes(sa)) {
      indicators++;
    }
  }
  return indicators >= lines.length / 2;
}

// ============================================================================
// XML PARSER (X83/X84)
// ============================================================================

const ITEM_SELECTORS = ['Item', 'BoQItem', 'Position'];

const FIELD_SELECTORS = {
  oz: ['Itemno', 'OZ', 'Nr', 'RNoPart'],
  text: ['Description > Text', 'Kurztext', 'ShortText', 'OutlineText > TextOutlTxt > span', 'Langtext'],
  qty: ['Qty', 'Menge', 'Quantity'],
  unit: ['QU', 'Einheit', 'Unit', 'BaseUnit'],
};

function parseGaebXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML-Parsing-Fehler: ${parseError.textContent.substring(0, 200)}`);
  }

  let items = findItems(doc);

  if (items.length === 0) {
    const cleanedXml = removeNamespaces(xmlString);
    const cleanDoc = parser.parseFromString(cleanedXml, 'application/xml');
    if (!cleanDoc.querySelector('parsererror')) {
      items = findItems(cleanDoc);
    }
  }

  if (items.length === 0) {
    throw new Error(
      'Keine Positionen im GAEB-Dokument gefunden. Unterstützte Formate: GAEB DA XML 3.x (DA83, DA86).'
    );
  }

  return items;
}

function findItems(doc) {
  const positions = [];

  for (const selector of ITEM_SELECTORS) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      for (const el of elements) {
        const position = extractPosition(el);
        if (position) positions.push(position);
      }
      break;
    }
  }

  if (positions.length === 0) {
    const allElements = doc.querySelectorAll('*');
    for (const el of allElements) {
      const tagName = el.localName || el.tagName || '';
      if (/^(item|boqitem|position)$/i.test(tagName)) {
        const position = extractPosition(el);
        if (position) positions.push(position);
      }
    }
  }

  return positions;
}

function extractPosition(el) {
  const oz = findFieldValue(el, FIELD_SELECTORS.oz) || '';
  const text = findFieldValue(el, FIELD_SELECTORS.text) || '';
  const qtyStr = findFieldValue(el, FIELD_SELECTORS.qty) || '0';
  const unit = findFieldValue(el, FIELD_SELECTORS.unit) || '';

  if (!oz && !text) return null;

  return {
    oz: oz.trim(),
    text: cleanText(text),
    qty: parseGermanNumber(qtyStr),
    unit: unit.trim(),
    ep: null,
    isHeader: false,
  };
}

function findFieldValue(parent, selectors) {
  for (const selector of selectors) {
    try {
      const el = parent.querySelector(selector);
      if (el && el.textContent) return el.textContent;
    } catch { /* ignore */ }
    const tagName = selector.split('>').pop().trim().split(' ').pop();
    const elements = parent.getElementsByTagName(tagName);
    if (elements.length > 0 && elements[0].textContent) {
      return elements[0].textContent;
    }
  }
  for (const selector of selectors) {
    const attrName = selector.toLowerCase();
    if (parent.hasAttribute(attrName)) {
      return parent.getAttribute(attrName);
    }
  }
  return null;
}

function removeNamespaces(xmlString) {
  return xmlString
    .replace(/\sxmlns(:\w+)?="[^"]*"/g, '')
    .replace(/<\/?[\w]+:/g, (match) => match.startsWith('</') ? '</' : '<');
}

// ============================================================================
// GAEB 2000 TAGGED FORMAT PARSER
// ============================================================================

function parseGaeb2000Tagged(content) {
  const segments = parseGaeb2000OzSegments(content);
  const positions = [];
  const lines = content.split('\n');

  const hierarchyStack = [];
  let inPosition = false;
  let inBeschreibung = false;
  let inLangtext = false;

  let posOz = null;
  let posKurztext = null;
  let posLangtextLines = [];
  let posME = null;
  let posMenge = null;

  for (const line of lines) {
    const stripped = line.trim();

    if (!stripped) {
      if (inLangtext) posLangtextLines.push('');
      continue;
    }

    // LVBereich hierarchy
    if (stripped === '#begin[LVBereich]') {
      hierarchyStack.push({ oz: null, bez: null });
      continue;
    }
    if (stripped === '#end[LVBereich]') {
      if (hierarchyStack.length) hierarchyStack.pop();
      continue;
    }

    // Position blocks
    if (stripped === '#begin[Position]') {
      inPosition = true;
      inBeschreibung = false;
      inLangtext = false;
      posOz = null;
      posKurztext = null;
      posLangtextLines = [];
      posME = null;
      posMenge = null;
      continue;
    }

    if (stripped === '#end[Position]') {
      if (inPosition && (posOz || posKurztext)) {
        const formattedOz = posOz && segments.length
          ? formatGaeb2000Oz(posOz, segments) : posOz;
        const hierarchyNames = hierarchyStack.filter(h => h.bez).map(h => h.bez);
        const section = hierarchyNames.length ? hierarchyNames.join(' > ') : '';

        let quantity = 0;
        if (posMenge) {
          try { quantity = parseFloat(posMenge.replace(',', '.')) || 0; } catch { /* */ }
        }

        let longText = '';
        if (posLangtextLines.length) {
          while (posLangtextLines.length && !posLangtextLines[posLangtextLines.length - 1]) {
            posLangtextLines.pop();
          }
          longText = posLangtextLines.join('\n');
        }

        positions.push({
          oz: formattedOz || '',
          text: posKurztext || '',
          longText,
          qty: quantity,
          unit: posME || '',
          section,
          isHeader: false,
        });
      }
      inPosition = false;
      inBeschreibung = false;
      inLangtext = false;
      continue;
    }

    // LVBereich values (outside Position)
    if (hierarchyStack.length && !inPosition) {
      const ozMatch = stripped.match(/^\[OZ\](.*?)\[end\]$/);
      if (ozMatch) {
        hierarchyStack[hierarchyStack.length - 1].oz = ozMatch[1].trim();
        continue;
      }
      const bezMatch = stripped.match(/^\[Bez\](.*?)\[end\]$/);
      if (bezMatch) {
        const bez = bezMatch[1].trim();
        hierarchyStack[hierarchyStack.length - 1].bez = bez;
        const hierarchyNames = hierarchyStack.filter(h => h.bez).map(h => h.bez);
        const section = hierarchyNames.join(' > ');
        positions.push({
          oz: hierarchyStack[hierarchyStack.length - 1].oz || '',
          text: bez,
          longText: '',
          qty: 0,
          unit: '',
          section,
          isHeader: true,
        });
        continue;
      }
    }

    // Position values
    if (inPosition) {
      if (!inBeschreibung) {
        const ozMatch = stripped.match(/^\[OZ\](.*?)\[end\]$/);
        if (ozMatch) { posOz = ozMatch[1].trim(); continue; }
        const meMatch = stripped.match(/^\[ME\](.*?)\[end\]$/);
        if (meMatch) { posME = meMatch[1].trim(); continue; }
        const mengeMatch = stripped.match(/^\[Menge\](.*?)\[end\]$/);
        if (mengeMatch) { posMenge = mengeMatch[1].trim(); continue; }
      }

      if (stripped === '#begin[Beschreibung]') { inBeschreibung = true; continue; }
      if (stripped === '#end[Beschreibung]') { inBeschreibung = false; inLangtext = false; continue; }

      if (inBeschreibung) {
        const ktMatch = stripped.match(/^\[Kurztext\](.*?)\[end\]$/);
        if (ktMatch) { posKurztext = ktMatch[1].trim(); continue; }

        if (!inLangtext && stripped.startsWith('[Langtext]')) {
          inLangtext = true;
          if (stripped.includes('[end]')) {
            const text = stripped.substring(10, stripped.lastIndexOf('[end]')).trim();
            if (text) posLangtextLines.push(text);
            inLangtext = false;
          } else {
            const text = stripped.substring(10).trim();
            if (text) posLangtextLines.push(text);
          }
          continue;
        }

        if (inLangtext) {
          if (stripped.includes('[end]')) {
            const text = stripped.substring(0, stripped.indexOf('[end]')).trim();
            if (text) posLangtextLines.push(text);
            inLangtext = false;
          } else {
            posLangtextLines.push(stripped);
          }
          continue;
        }
      }
    }
  }

  return positions;
}

function parseGaeb2000OzSegments(content) {
  const segments = [];
  let inLvglied = false;
  let currentTyp = null;
  let currentLaenge = null;

  for (const line of content.split('\n')) {
    const s = line.trim();
    if (s === '#begin[LVGlied]') { inLvglied = true; currentTyp = null; currentLaenge = null; continue; }
    if (s === '#end[LVGlied]') {
      if (inLvglied && currentTyp != null && currentLaenge != null) {
        segments.push({ typ: currentTyp, laenge: currentLaenge });
      }
      inLvglied = false;
      continue;
    }
    if (inLvglied) {
      const typMatch = s.match(/^\[Typ\](.*?)\[end\]$/);
      if (typMatch) currentTyp = typMatch[1].trim();
      const lenMatch = s.match(/^\[Laenge\](\d+)\[end\]$/);
      if (lenMatch) currentLaenge = parseInt(lenMatch[1], 10);
    }
  }
  return segments;
}

function formatGaeb2000Oz(rawOz, segments) {
  if (!segments.length || !rawOz) return rawOz;
  const active = segments.filter(s => s.typ !== 'Index');
  const parts = [];
  let pos = 0;
  for (const seg of active) {
    if (pos >= rawOz.length) break;
    parts.push(rawOz.substring(pos, pos + seg.laenge));
    pos += seg.laenge;
  }
  if (pos < rawOz.length) parts.push(rawOz.substring(pos));
  return parts.join('.');
}

// ============================================================================
// D83/P83 FIXED-WIDTH ASCII FORMAT PARSER
// ============================================================================

const UNIT_PATTERN = /(?:psch|Psch|PSCH|Stck|Stk|STK|lfm|LFM|cbm|qm|Std|Tag|m2|m3|m²|m³|kg|KG|St|ha|km|cm|mm|h|t|l|m)/;
const UNIT_MAP = { m2: 'm²', m3: 'm³', stk: 'St', stck: 'St', cbm: 'm³', qm: 'm²' };
const UNIT_CODES = {
  '0000': 'psch', '0001': 'm', '0002': 'm²', '0003': 'm³',
  '0004': 'kg', '0005': 't', '0006': 'St', '0007': 'l',
  '0008': 'lfm', '0009': 'cbm', '0010': 'qm', '0011': 'Tag',
  '0012': 'Std', '0099': 'psch',
};

function parseD83Content(content) {
  const positions = [];
  const lines = content.split('\n');

  // Pass 1: Infer OZ segment structure
  const ozSegments = prescanD83Segments(lines);

  // Collect section names from SA 11/12
  const sectionNames = {};
  let currentSa11Oz = null;
  for (const line of lines) {
    if (line.length < 2) continue;
    const sa = line.substring(0, 2).trim();
    if (sa === '11') {
      const ozField = line.substring(2, Math.min(14, line.length));
      const ozDigits = ozField.replace(/\D/g, '');
      if (ozDigits) currentSa11Oz = ozDigits;
    } else if (sa === '12' && currentSa11Oz) {
      const name = cleanD83Text(line.substring(2));
      if (name && !sectionNames[currentSa11Oz]) sectionNames[currentSa11Oz] = name;
    }
  }

  // Pass 2: Parse positions
  let currentPosition = null;
  let currentSection = null;
  const currentHierarchy = [];
  let langtextLines = [];
  const hierarchyStack = [];

  for (const line of lines) {
    if (!line.trim() || line.length < 2) continue;
    const sa = line.substring(0, 2).trim();

    // Section (SA 11)
    if (sa === '11') {
      const ozField = line.substring(2, Math.min(14, line.length));
      const ozDigits = ozField.replace(/\D/g, '');
      if (ozDigits) {
        while (hierarchyStack.length && hierarchyStack[hierarchyStack.length - 1][0].length >= ozDigits.length) {
          hierarchyStack.pop();
        }
        const name = sectionNames[ozDigits] || '';
        hierarchyStack.push([ozDigits, name]);
        const names = hierarchyStack.filter(h => h[1]).map(h => h[1]);
        currentSection = names.join(' > ');
        currentHierarchy.length = 0;
        currentHierarchy.push(...names);

        const formattedOz = ozSegments.length
          ? formatOzWithSegments(ozDigits, ozSegments) : formatOz(ozDigits);
        if (name) {
          positions.push({
            oz: formattedOz || ozDigits,
            text: name,
            longText: '',
            qty: 0,
            unit: '',
            section: currentSection,
            isHeader: true,
          });
        }
      }
    }

    // Section boundary (SA 20)
    else if (sa === '20') {
      if (currentPosition) {
        if (langtextLines.length) currentPosition.longText = langtextLines.join('\n');
        positions.push(currentPosition);
        currentPosition = null;
        langtextLines = [];
      }
    }

    // Position header (SA 21)
    else if (sa === '21') {
      if (currentPosition) {
        if (langtextLines.length) currentPosition.longText = langtextLines.join('\n');
        positions.push(currentPosition);
        langtextLines = [];
      }
      currentPosition = parseD83PositionLine(line, currentSection, ozSegments);
    }

    // Short text (SA 25)
    else if (sa === '25' && currentPosition) {
      const kurztext = cleanD83Text(line.substring(2));
      if (kurztext) {
        currentPosition.text = currentPosition.text
          ? currentPosition.text + ' ' + kurztext : kurztext;
      }
    }

    // Long text (SA 26)
    else if (sa === '26' && currentPosition) {
      const langtext = cleanD83Text(line.substring(2));
      if (langtext) langtextLines.push(langtext);
    }
  }

  // Don't forget last position
  if (currentPosition) {
    if (langtextLines.length) currentPosition.longText = langtextLines.join('\n');
    positions.push(currentPosition);
  }

  return positions;
}

function prescanD83Segments(lines) {
  const sectionDigitLengths = new Set();
  for (const line of lines) {
    if (line.length < 2) continue;
    if (line.substring(0, 2).trim() === '11') {
      const ozField = line.substring(2, Math.min(14, line.length));
      const ozDigits = ozField.replace(/\D/g, '');
      if (ozDigits) sectionDigitLengths.add(ozDigits.length);
    }
  }
  if (sectionDigitLengths.size === 0) return [];
  const sorted = [...sectionDigitLengths].sort((a, b) => a - b);
  const segs = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) segs.push(sorted[i] - sorted[i - 1]);
  return segs;
}

function formatOzWithSegments(allDigits, segments) {
  if (!allDigits || !segments.length) return null;
  const parts = [];
  let pos = 0;
  for (const segLen of segments) {
    if (pos >= allDigits.length) break;
    parts.push(allDigits.substring(pos, pos + segLen));
    pos += segLen;
  }
  if (pos < allDigits.length) parts.push(allDigits.substring(pos));
  return parts.join('.');
}

function formatOz(ozRaw) {
  ozRaw = ozRaw.trim();
  if (ozRaw.includes('.') && !ozRaw.includes(' ')) {
    const parts = ozRaw.split('.');
    if (parts.length >= 3) {
      return `${parseInt(parts[0]) || parts[0]}.${parseInt(parts[1]) || parts[1]}.${parseInt(parts[2]) || parts[2]}`;
    }
  }
  const digits = ozRaw.replace(/\D/g, '');
  if (!digits) return ozRaw;
  if (digits.length >= 6) return `${parseInt(digits.substring(0, 2))}.${parseInt(digits.substring(2, 4))}.${parseInt(digits.substring(4))}`;
  if (digits.length >= 4) return `${parseInt(digits.substring(0, 2))}.${parseInt(digits.substring(2))}`;
  return digits;
}

function cleanD83Text(text) {
  if (!text) return text;
  return text
    .replace(/\s+\d{6}(?=\s|$)/g, '')
    .replace(/\b\d{6}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseD83PositionLine(line, section, ozSegments) {
  const pos = {
    oz: '',
    text: '',
    longText: '',
    qty: 0,
    unit: '',
    section: section || '',
    isHeader: false,
  };

  try {
    if (line.length < 20) return pos;
    const dataPart = line.substring(2, 75);

    const unitMatch = UNIT_PATTERN.exec(dataPart);
    if (unitMatch) {
      const unitRaw = unitMatch[0];
      pos.unit = UNIT_MAP[unitRaw.toLowerCase()] || unitRaw;

      const preUnit = dataPart.substring(0, unitMatch.index);
      const mengeMatch = preUnit.match(/(\d{5,15})\s*$/);
      if (mengeMatch) {
        const mengeDigits = mengeMatch[1];
        const mengeValue = parseInt(mengeDigits, 10) / 1000;
        if (mengeValue > 0) pos.qty = mengeValue;
        const ozArea = dataPart.substring(0, mengeMatch.index);
        pos.oz = parseOzFromArea(ozArea, ozSegments) || '';
      } else {
        const ozArea = dataPart.substring(0, unitMatch.index);
        pos.oz = parseOzFromArea(ozArea, ozSegments) || '';
      }
    } else {
      // Numeric unit codes fallback
      if (line.length >= 30) {
        const ozRaw = line.substring(2, 14).trim();
        const ozDigits = ozRaw.replace(/\D/g, '');
        if (ozDigits.length >= 3) {
          pos.oz = ozSegments.length
            ? formatOzWithSegments(ozDigits, ozSegments) || formatOz(ozDigits)
            : formatOz(ozDigits);
          const mengeRaw = line.substring(14, 26).trim();
          const mengeDigits = mengeRaw.replace(/\D/g, '');
          if (mengeDigits) {
            const mengeValue = parseInt(mengeDigits, 10) / 1000;
            if (mengeValue > 0) pos.qty = mengeValue;
          }
          const einheitRaw = line.substring(26, 30).trim();
          if (einheitRaw) pos.unit = UNIT_CODES[einheitRaw] || einheitRaw;
        }
      }
    }
  } catch { /* ignore parse errors */ }

  return pos;
}

function parseOzFromArea(ozArea, ozSegments) {
  ozArea = ozArea.trim();
  if (!ozArea) return null;
  const allDigits = ozArea.replace(/\D/g, '');
  if (!allDigits) return null;
  if (ozSegments && ozSegments.length) return formatOzWithSegments(allDigits, ozSegments);

  const digitGroups = ozArea.match(/\d+/g);
  if (!digitGroups) return null;
  const first = digitGroups[0];
  if (digitGroups.length >= 3 && first.length <= 2) {
    return `${parseInt(digitGroups[0])}.${parseInt(digitGroups[1])}.${parseInt(digitGroups[2])}`;
  }
  if (digitGroups.length === 2 && first.length <= 2) {
    return `${parseInt(digitGroups[0])}.${parseInt(digitGroups[1])}`;
  }
  if (first.length >= 6) return `${parseInt(first.substring(0, 2))}.${parseInt(first.substring(2, 4))}.${parseInt(first.substring(4))}`;
  if (first.length >= 4) return `${parseInt(first.substring(0, 2))}.${parseInt(first.substring(2))}`;
  return null;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

function parseGermanNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).trim();
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (/^\d+(,\d+)$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}
