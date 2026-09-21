/**
 * Markdown helpers.
 *
 * The only rule here that is not cosmetic: import parsing skips code spans and
 * fenced code blocks, so anything that scans for `@path` must strip those
 * first. Documented at https://code.claude.com/docs/en/memory
 *   "Import parsing skips Markdown code spans and fenced code blocks."
 */

/** Remove fenced blocks and inline code spans, preserving line count. */
export function withoutCode(text) {
  const blanked = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, blanked)
    .replace(/`(?:[^`\n]|\n(?!\s*\n))*`/g, blanked);
}

/** Every `@path` import in a file, in order, with its 1-based line number. */
export function imports(text) {
  const clean = withoutCode(text);
  const found = [];
  clean.split('\n').forEach((line, i) => {
    const re = /(^|[\s(<"'])@([^\s)>"'`]+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const spec = m[2].replace(/[.,;:]+$/, '');
      if (spec) found.push({ spec, line: i + 1 });
    }
  });
  return found;
}

export const lineCount = (text) => text.split('\n').length;
