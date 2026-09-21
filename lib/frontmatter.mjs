/**
 * A deliberately small YAML front matter reader.
 *
 * It handles the shapes skills actually use — scalars, quoted strings, inline
 * lists — and refuses anything else rather than guessing. A parser that guesses
 * produces false findings, which is the one failure this tool cannot afford
 * (DECISIONS.md D-0004).
 */

const unquote = (v) => {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
};

export function readFrontmatter(text) {
  // Documented: the frontmatter is read only when the opening --- is the very
  // first line. https://code.claude.com/docs/en/skills
  const startsAtFirstLine = text.startsWith('---\n') || text.startsWith('---\r\n');
  const hasDelimiterLater = /^---[ \t]*$/m.test(text) && !startsAtFirstLine;

  if (!startsAtFirstLine) {
    return { present: false, atFirstLine: false, looksLikeFrontmatter: hasDelimiterLater, data: {}, body: text };
  }

  const rest = text.slice(text.indexOf('\n') + 1);
  const end = rest.search(/^---[ \t]*\r?$/m);
  if (end === -1) {
    return { present: false, atFirstLine: true, unterminated: true, data: {}, body: text };
  }

  const block = rest.slice(0, end);
  const body = rest.slice(end).replace(/^---[ \t]*\n?/, '');
  const data = {};
  let key = null;

  for (const rawLine of block.split('\n')) {
    // Strip a trailing \r once, here, rather than at every field check below
    // — CRLF text would otherwise leave it stuck to the last field on the
    // line, breaking the exact-match checks for booleans and arrays.
    const raw = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const top = raw.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (top) {
      key = top[1];
      const value = top[2];
      if (value === '' ) data[key] = '';
      else if (value === 'true' || value === 'false') data[key] = value === 'true';
      else if (value.startsWith('[') && value.endsWith(']')) {
        // Split on commas outside quotes, so a quoted item like "a, b" survives.
        const items = value.slice(1, -1).match(/"[^"]*"|'[^']*'|[^,]+/g) || [];
        data[key] = items.map(unquote).filter(Boolean);
      } else data[key] = unquote(value);
      continue;
    }
    // Continuation of the previous scalar, or a block list item.
    if (key !== null && /^[ \t]+/.test(raw)) {
      const item = raw.trim();
      if (item.startsWith('- ')) {
        if (!Array.isArray(data[key])) data[key] = data[key] ? [String(data[key])] : [];
        data[key].push(unquote(item.slice(2)));
      } else if (typeof data[key] === 'string') {
        data[key] = `${data[key]} ${item}`.trim();
      }
    }
  }

  return { present: true, atFirstLine: true, data, body };
}
