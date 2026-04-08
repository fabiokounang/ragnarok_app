'use strict';

/**
 * Parse Grimoire longform .txt: sections start with "## Heading" (markdown h2).
 * Paragraphs separated by blank lines under each heading.
 */
function parseLongform(txt) {
  const trimmed = String(txt || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!trimmed) return [];

  const chunks = trimmed.split(/\n(?=##[ \t])/);
  const sections = [];

  for (const chunk of chunks) {
    const c = chunk.trim();
    if (!c) continue;
    const nl = c.indexOf('\n');
    const firstLine = nl === -1 ? c : c.slice(0, nl).trim();
    const rest = nl === -1 ? '' : c.slice(nl + 1).trim();
    const heading = firstLine.replace(/^##+\s*/, '').trim() || 'Section';
    const paragraphs = rest
      ? rest
          .split(/\n{2,}/)
          .map((p) => p.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
      : [];
    if (paragraphs.length) {
      sections.push({ heading, paragraphs });
    }
  }

  return sections;
}

module.exports = { parseLongform };
