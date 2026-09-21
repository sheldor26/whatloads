/**
 * The project's .mcp.json. Three documented footguns: a url with no type,
 * credential variables that read as empty by design, and any other ${VAR}
 * reference that has nothing to expand and loads as the literal text.
 */

import { DOCS } from '../lib/docs.mjs';

const CREDENTIAL_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'AWS_BEARER_TOKEN_BEDROCK', 'HTTPS_PROXY', 'NPM_TOKEN'];
const VAR_REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)(:-[^}]*)?\}/g;

export const coverage = [
  "the project's .mcp.json: whether it parses, and whether every http/sse/ws entry declares a type",
  'credential variables named in a url or headers field, which Claude Code always reads as empty there, with no warning',
  '${VAR} references anywhere in the file with no default that are unset in this environment, which load as the literal text',
];

function varRefs(value) {
  if (typeof value !== 'string') return [];
  const out = [];
  let m;
  VAR_REF.lastIndex = 0;
  while ((m = VAR_REF.exec(value))) out.push({ name: m[1], hasDefault: Boolean(m[2]) });
  return out;
}

export function run(setup) {
  const findings = [];
  const file = setup.mcp;
  if (!file) return { findings, facts: { servers: 0 } };

  const where = setup.rel(file.path);

  if (file.data === null) {
    findings.push({
      severity: 'high',
      title: 'This .mcp.json file is not valid JSON',
      where,
      detail: `No server in it connects. Parser said: ${file.error}`,
      doc: DOCS.mcpConfigFormat,
    });
    return { findings, facts: { servers: 0 } };
  }

  const servers = file.data && typeof file.data.mcpServers === 'object' ? file.data.mcpServers : {};

  for (const [name, entry] of Object.entries(servers)) {
    if (!entry || typeof entry !== 'object') continue;

    if (entry.url && !entry.type) {
      findings.push({
        severity: 'high',
        title: `"${name}" has a url but no type, so Claude Code reads it as a stdio server`,
        where,
        detail: 'Add "type": "http" (or "sse" / "ws") to this entry. Without it the connection is skipped, not attempted.',
        doc: DOCS.mcpUrlNeedsType,
      });
    }

    const fields = [];
    if (typeof entry.url === 'string') fields.push({ value: entry.url, credentialScope: true });
    if (entry.headers && typeof entry.headers === 'object') {
      for (const v of Object.values(entry.headers)) fields.push({ value: v, credentialScope: true });
    }
    if (typeof entry.command === 'string') fields.push({ value: entry.command, credentialScope: false });
    if (Array.isArray(entry.args)) for (const v of entry.args) fields.push({ value: v, credentialScope: false });
    if (entry.env && typeof entry.env === 'object') {
      for (const v of Object.values(entry.env)) fields.push({ value: v, credentialScope: false });
    }

    for (const { value, credentialScope } of fields) {
      for (const ref of varRefs(value)) {
        if (credentialScope && CREDENTIAL_VARS.includes(ref.name)) {
          findings.push({
            severity: 'high',
            title: `"${name}" sends \${${ref.name}} in its url or headers, which reads as empty there`,
            where,
            detail: 'Deliberate, so a project file or plugin cannot exfiltrate your own credentials to a server it names — and there is no warning for it. Whatever this server expects in that value, it gets nothing.',
            doc: DOCS.mcpCredentialVariablesEmpty,
          });
        } else if (!ref.hasDefault && !(ref.name in process.env)) {
          findings.push({
            severity: 'medium',
            title: `"${name}" references \${${ref.name}}, which is not set in this environment`,
            where,
            detail: `Without a value the server still loads, with the literal text "\${${ref.name}}" in place of it. Set the variable, or add a :-default.`,
            doc: DOCS.mcpUnsetEnvVarLiteral,
          });
        }
      }
    }
  }

  return { findings, facts: { servers: Object.keys(servers).length } };
}
