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
 * @param {string|ArrayBuffer} content - File content as string or ArrayBuffer
 * @param {string} [fileName] - Optional filename for format detection
 * @returns {Array<{oz, text, longText, qty, unit, section, isHeader}>}
 */
export function parseGAEB(content, fileName) {
  // Handle ArrayBuffer input — needed for D83/P83 files (CP437 encoding)
  if (content instanceof ArrayBuffer) {
    content = decodeGaebBuffer(content, fileName);
  }

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

/**
 * Extract project metadata from a GAEB file.
 * @param {string|ArrayBuffer} content - File content
 * @param {string} [fileName] - Optional filename
 * @returns {{ name, client, service, tender_number }}
 */
export function parseGAEBMeta(content, fileName) {
  if (content instanceof ArrayBuffer) {
    content = decodeGaebBuffer(content, fileName);
  }
  if (!content || typeof content !== 'string') return {};

  const trimmed = content.trim();

  if (isXmlFormat(trimmed)) {
    return extractXmlMeta(trimmed);
  }
  if (isD83Format(trimmed, fileName) || isGaeb2000Tagged(trimmed)) {
    return extractD83Meta(trimmed);
  }
  return {};
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
// ENCODING — CP437 decoding for GAEB 83 ASCII files
// ============================================================================

// CP437 to Unicode mapping for bytes 0x80–0xFF
const CP437_HIGH = '\u00C7\u00FC\u00E9\u00E2\u00E4\u00E0\u00E5\u00E7\u00EA\u00EB\u00E8\u00EF\u00EE\u00EC\u00C4\u00C5\u00C9\u00E6\u00C6\u00F4\u00F6\u00F2\u00FB\u00F9\u00FF\u00D6\u00DC\u00A2\u00A3\u00A5\u20A7\u0192\u00E1\u00ED\u00F3\u00FA\u00F1\u00D1\u00AA\u00BA\u00BF\u2310\u00AC\u00BD\u00BC\u00A1\u00AB\u00BB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\u00DF\u0393\u03C0\u03A3\u03C3\u00B5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\u00B1\u2265\u2264\u2320\u2321\u00F7\u2248\u00B0\u2219\u00B7\u221A\u207F\u00B2\u25A0\u00A0';

function decodeCP437(buffer) {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      result += String.fromCharCode(b);
    } else {
      result += CP437_HIGH[b - 0x80];
    }
  }
  return result;
}

/**
 * Decode a GAEB file buffer with the correct encoding.
 * XML files are UTF-8, D83/P83 ASCII files use CP437.
 */
function decodeGaebBuffer(buffer, fileName) {
  const bytes = new Uint8Array(buffer);
  // Quick check: if it starts with XML declaration or <GAEB, use UTF-8
  const head = String.fromCharCode(...bytes.slice(0, 20));
  if (head.startsWith('<?xml') || head.startsWith('<GAEB') || head.startsWith('<gaeb')) {
    return new TextDecoder('utf-8').decode(buffer);
  }
  // Check for GAEB 2000 tagged format
  const headLong = String.fromCharCode(...bytes.slice(0, Math.min(500, bytes.length)));
  if (headLong.includes('#begin[GAEB]')) {
    return new TextDecoder('utf-8').decode(buffer);
  }
  // D83/P83: use CP437
  return decodeCP437(buffer);
}

// ============================================================================
// XML PARSER (X83/X84) — Hierarchical BoQ walker
// ============================================================================

function parseGaebXml(xmlString) {
  const parser = new DOMParser();

  // Try with namespaces first, then without
  let doc = parser.parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(`XML-Parsing-Fehler: ${doc.querySelector('parsererror').textContent.substring(0, 200)}`);
  }

  // Remove namespaces for reliable querySelector usage
  const cleanedXml = removeNamespaces(xmlString);
  const cleanDoc = parser.parseFromString(cleanedXml, 'application/xml');
  if (!cleanDoc.querySelector('parsererror')) {
    doc = cleanDoc;
  }

  // Find the BoQ body — walk BoQCtgy hierarchy
  const boqBody = doc.querySelector('BoQBody') || doc.querySelector('boqbody');
  if (boqBody) {
    const positions = [];
    walkBoQBody(boqBody, [], positions);
    if (positions.length > 0) return positions;
  }

  // Fallback: flat Item scan (for non-standard GAEB XML)
  const items = doc.querySelectorAll('Item, BoQItem, Position');
  if (items.length > 0) {
    const positions = [];
    for (const el of items) {
      const pos = extractXmlItem(el, '');
      if (pos) positions.push(pos);
    }
    if (positions.length > 0) return positions;
  }

  throw new Error(
    'Keine Positionen im GAEB-Dokument gefunden. Unterstützte Formate: GAEB DA XML 3.x (DA83, DA86).'
  );
}

/**
 * Recursively walk BoQBody > BoQCtgy hierarchy to build OZ numbers and extract items.
 */
function walkBoQBody(bodyEl, ozPrefix, positions) {
  for (const child of bodyEl.children) {
    const tag = (child.localName || child.tagName || '').toLowerCase();

    if (tag === 'boqctgy') {
      const rnoPart = child.getAttribute('RNoPart') || child.getAttribute('rnopart') || '';
      const currentOz = [...ozPrefix, rnoPart];
      const ozStr = formatXmlOz(currentOz);

      // Extract category label from LblTx
      const lblTx = directChild(child, 'LblTx');
      if (lblTx) {
        const label = stripHtml(lblTx.textContent || '');
        if (label) {
          positions.push({
            oz: ozStr,
            text: label,
            longText: '',
            qty: 0,
            unit: '',
            section: label,
            isHeader: true,
          });
        }
      }

      // Recurse into nested BoQBody
      const nestedBody = directChild(child, 'BoQBody');
      if (nestedBody) {
        walkBoQBody(nestedBody, currentOz, positions);
      }

    } else if (tag === 'itemlist') {
      // Process children: Remark (Vorbemerkungen) and Item elements
      for (const item of child.children) {
        const itemTag = (item.localName || item.tagName || '').toLowerCase();
        if (itemTag === 'remark') {
          const remarkPos = extractXmlRemark(item, ozPrefix);
          if (remarkPos) positions.push(remarkPos);
        } else if (itemTag === 'item' || itemTag === 'boqitem') {
          const pos = extractXmlItem(item, ozPrefix);
          if (pos) positions.push(pos);
        }
      }
    }
  }
}

/**
 * Extract a position from an Item element.
 */
function extractXmlItem(el, ozPrefix) {
  const rnoPart = el.getAttribute('RNoPart') || el.getAttribute('rnopart') || '';
  const itemOzParts = Array.isArray(ozPrefix) ? [...ozPrefix, rnoPart] : [rnoPart];
  const oz = formatXmlOz(itemOzParts);

  // Kurztext: OutlineText > OutlTxt > TextOutlTxt
  const kurztext = extractOutlineText(el);

  // Langtext: DetailTxt > Text (full description with line breaks)
  const langtext = extractDetailText(el);

  // Quantity — GAEB XML always uses standard decimal (dot = decimal separator)
  const qtyEl = directChild(el, 'Qty') || el.querySelector('Qty');
  const qty = qtyEl ? (parseFloat(qtyEl.textContent) || 0) : 0;

  // Unit
  const quEl = directChild(el, 'QU') || el.querySelector('QU');
  const unit = quEl ? quEl.textContent.trim() : '';

  const text = kurztext || (langtext ? langtext.split('\n')[0] : '');
  if (!oz && !text && !langtext) return null;

  return {
    oz,
    text: cleanText(text),
    longText: langtext,
    qty,
    unit: unit,
    ep: null,
    isHeader: false,
  };
}

/**
 * Extract a Remark (Vorbemerkung) element as a non-priced position.
 */
function extractXmlRemark(el, ozPrefix) {
  const kurztext = extractOutlineText(el);
  const langtext = extractDetailText(el);
  const text = kurztext || (langtext ? langtext.split('\n')[0] : '');
  if (!text && !langtext) return null;

  return {
    oz: '',
    text: cleanText(text),
    longText: langtext,
    qty: 0,
    unit: '',
    ep: null,
    isHeader: false,
  };
}

/**
 * Extract Kurztext from OutlineText > OutlTxt > TextOutlTxt, stripping HTML.
 */
function extractOutlineText(el) {
  // Try nested path first
  const outlinePaths = [
    'Description CompleteText OutlineText OutlTxt TextOutlTxt',
    'Description OutlineText OutlTxt TextOutlTxt',
    'OutlineText OutlTxt TextOutlTxt',
    'Description CompleteText OutlineText TextOutlTxt',
  ];
  for (const path of outlinePaths) {
    try {
      const found = el.querySelector(path.split(' ').join(' > '));
      if (found && found.textContent.trim()) return stripHtml(found.textContent);
    } catch { /* ignore selector errors */ }
  }
  // Fallback: try getElementsByTagName
  const tags = el.getElementsByTagName('TextOutlTxt');
  if (tags.length > 0 && tags[0].textContent.trim()) return stripHtml(tags[0].textContent);

  // Last fallback: ShortText / Kurztext
  for (const tag of ['ShortText', 'Kurztext']) {
    const found = el.getElementsByTagName(tag);
    if (found.length > 0 && found[0].textContent.trim()) return stripHtml(found[0].textContent);
  }
  return '';
}

/**
 * Extract Langtext from DetailTxt > Text, converting HTML paragraphs to plain text.
 */
function extractDetailText(el) {
  const detailPaths = [
    'Description CompleteText DetailTxt Text',
    'Description DetailTxt Text',
    'CompleteText DetailTxt Text',
    'DetailTxt Text',
  ];
  for (const path of detailPaths) {
    try {
      const found = el.querySelector(path.split(' ').join(' > '));
      if (found) {
        const text = htmlToPlainText(found);
        if (text.trim()) return text.trim();
      }
    } catch { /* ignore */ }
  }
  // Fallback via getElementsByTagName
  const detailTxts = el.getElementsByTagName('DetailTxt');
  if (detailTxts.length > 0) {
    const textEls = detailTxts[0].getElementsByTagName('Text');
    if (textEls.length > 0) {
      const text = htmlToPlainText(textEls[0]);
      if (text.trim()) return text.trim();
    }
  }
  // Last fallback: try Langtext element directly
  const langEls = el.getElementsByTagName('Langtext');
  if (langEls.length > 0 && langEls[0].textContent.trim()) {
    return stripHtml(langEls[0].textContent);
  }
  return '';
}

/**
 * Convert HTML-like GAEB XML text (with <p>, <span>, <br/>) to plain text
 * preserving paragraph breaks.
 */
function htmlToPlainText(el) {
  const lines = [];
  for (const child of el.children) {
    const tag = (child.localName || child.tagName || '').toLowerCase();
    if (tag === 'p') {
      // Walk the <p> collecting text from spans, separated by br
      const segments = [];
      walkTextNode(child, segments);
      const text = segments.join('\n').trim();
      if (text) lines.push(text);
    }
  }
  if (lines.length > 0) return lines.join('\n');
  // Fallback: just get text content
  return stripHtml(el.textContent || '');
}

/**
 * Walk a DOM node collecting text, treating <br> as line break.
 */
function walkTextNode(node, segments) {
  for (const child of node.childNodes) {
    const tag = (child.localName || child.tagName || child.nodeName || '').toLowerCase();
    if (child.nodeType === 3) {
      // Text node
      const t = child.textContent.trim();
      if (t) {
        if (segments.length === 0) segments.push(t);
        else segments[segments.length - 1] += (segments[segments.length - 1] ? ' ' : '') + t;
      }
    } else if (tag === 'br') {
      segments.push('');
    } else if (tag === 'span' || tag === 'b' || tag === 'i' || tag === 'strong' || tag === 'em') {
      const t = child.textContent.trim();
      if (t) {
        if (segments.length === 0) segments.push(t);
        else segments[segments.length - 1] += (segments[segments.length - 1] ? ' ' : '') + t;
      }
    } else {
      walkTextNode(child, segments);
    }
  }
}

/**
 * Format OZ from parts array: ['1', '2', '3'] => '1. 2.   3'
 * Matches the format seen in the Excel: ' 1. 2.   3'
 */
function formatXmlOz(parts) {
  const filtered = parts.filter(Boolean);
  if (filtered.length === 0) return '';
  return filtered.map((p) => p.trim()).join('.');
}

/**
 * Strip HTML tags from text content.
 */
function stripHtml(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Find a direct child element by tag name (case-insensitive).
 */
function directChild(parent, tagName) {
  const lower = tagName.toLowerCase();
  for (const child of parent.children) {
    if ((child.localName || child.tagName || '').toLowerCase() === lower) {
      return child;
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

const UNIT_PATTERN = /(?:psch|Psch|PSCH|Stck|Stk|STK|StWo|StMt|lfdm|lfm|LFM|cbm|qm|Std|Tag|mWo|m2|m3|m²|m³|kg|KG|St|ha|km|cm|mm|h|t|l|m)/;
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
      // Flush any pending position before starting new section
      if (currentPosition) {
        if (langtextLines.length) currentPosition.longText = langtextLines.join('\n');
        positions.push(currentPosition);
        currentPosition = null;
        langtextLines = [];
      }

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
  const digitLengths = new Set();
  for (const line of lines) {
    if (line.length < 2) continue;
    const sa = line.substring(0, 2).trim();
    if (sa === '11') {
      const ozField = line.substring(2, Math.min(14, line.length));
      const ozDigits = ozField.replace(/\D/g, '');
      if (ozDigits) digitLengths.add(ozDigits.length);
    } else if (sa === '21') {
      // Also scan item lines for full OZ length
      const ozField = line.substring(2, Math.min(14, line.length));
      const ozDigits = ozField.replace(/\D/g, '');
      if (ozDigits) digitLengths.add(ozDigits.length);
    }
  }
  if (digitLengths.size === 0) return [];
  const sorted = [...digitLengths].sort((a, b) => a - b);
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
    return ozRaw;
  }
  const digits = ozRaw.replace(/\D/g, '');
  if (!digits) return ozRaw;
  // Default segment guess: [2, 2, remaining]
  if (digits.length >= 6) return `${digits.substring(0, 2)}.${digits.substring(2, 4)}.${digits.substring(4)}`;
  if (digits.length >= 4) return `${digits.substring(0, 2)}.${digits.substring(2)}`;
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

// ============================================================================
// PROJECT METADATA EXTRACTION
// ============================================================================

function extractXmlMeta(xmlString) {
  const parser = new DOMParser();
  const cleanedXml = removeNamespaces(xmlString);
  const doc = parser.parseFromString(cleanedXml, 'application/xml');
  if (doc.querySelector('parsererror')) return {};

  const meta = {};

  // Project name: PrjInfo > NamePrj or LblPrj
  const namePrj = doc.querySelector('PrjInfo > LblPrj') || doc.querySelector('PrjInfo > NamePrj');
  if (namePrj) meta.name = stripHtml(namePrj.textContent);

  // Client: OWN > Address > Name1
  const ownName = doc.querySelector('OWN > Address > Name1');
  if (ownName) meta.client = stripHtml(ownName.textContent);

  // Service from BoQ > Info > Name
  const boqName = doc.querySelector('BoQInfo > Name') || doc.querySelector('BoQInfo > NameBoQ');
  if (boqName) {
    const svc = stripHtml(boqName.textContent);
    // Only use if it's a real name (not just a number)
    if (svc && svc.length > 2 && !/^\d+$/.test(svc)) meta.service = svc;
  }

  return meta;
}

function extractD83Meta(content) {
  const meta = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines.slice(0, 30)) {
    if (line.length < 3) continue;
    const sa = line.substring(0, 2).trim();
    // Strip trailing 6-digit line numbers and extra whitespace
    const rawText = line.substring(2, Math.min(line.length, 74)).replace(/\s*\d{6}\s*$/, '').trim();

    // SA 01: LV-Bezeichnung (project/service name)
    if (sa === '01' && rawText && !meta.service) {
      meta.service = rawText;
    }
    // SA 02: BV-Bezeichnung (project name)
    if (sa === '02' && rawText && !meta.name) {
      meta.name = rawText;
    }
    // SA 03: Auftraggeber (client)
    if (sa === '03' && rawText && !meta.client) {
      meta.client = rawText;
    }
  }

  // If no BV name, use service as name
  if (!meta.name && meta.service) {
    meta.name = meta.service;
  }

  return meta;
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}
