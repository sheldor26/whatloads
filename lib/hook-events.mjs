/**
 * The documented hook events.
 *
 * `stdout` is what happens to plain-text stdout on exit 0:
 *   context   - added to the model's context (documented in the exceptions list)
 *   debug     - written to the debug log, never seen by the model
 *   ambiguous - the reference contradicts itself; treat as debug and use JSON
 *   discarded - dropped entirely
 */

export const EVENTS = {
  SessionStart:       { matcher: ['startup', 'resume', 'clear', 'compact', 'fork'], stdout: 'context' },
  Setup:              { matcher: ['init', 'maintenance'], stdout: 'debug' },
  UserPromptSubmit:   { matcher: false, stdout: 'context' },
  UserPromptExpansion:{ matcher: true, stdout: 'ambiguous' },
  PreToolUse:         { matcher: true, stdout: 'debug' },
  PermissionRequest:  { matcher: true, stdout: 'debug' },
  PermissionDenied:   { matcher: true, stdout: 'debug' },
  PostToolUse:        { matcher: true, stdout: 'debug' },
  PostToolUseFailure: { matcher: true, stdout: 'debug' },
  PostToolBatch:      { matcher: false, stdout: 'debug' },
  Stop:               { matcher: false, stdout: 'ambiguous' },
  StopFailure:        { matcher: true, stdout: 'discarded' },
  Notification:       { matcher: true, stdout: 'debug' },
  MessageDisplay:     { matcher: false, stdout: 'debug' },
  SubagentStart:      { matcher: true, stdout: 'debug' },
  SubagentStop:       { matcher: true, stdout: 'debug' },
  TaskCreated:        { matcher: false, stdout: 'debug' },
  TaskCompleted:      { matcher: false, stdout: 'debug' },
  TeammateIdle:       { matcher: false, stdout: 'debug' },
  InstructionsLoaded: { matcher: ['session_start', 'nested_traversal', 'path_glob_match', 'include', 'compact'], stdout: 'debug' },
  ConfigChange:       { matcher: ['user_settings', 'project_settings', 'local_settings', 'policy_settings', 'skills'], stdout: 'debug' },
  CwdChanged:         { matcher: false, stdout: 'debug' },
  DirectoryAdded:     { matcher: ['slash_command', 'register_repo_root'], stdout: 'debug' },
  FileChanged:        { matcher: true, stdout: 'debug' },
  WorktreeCreate:     { matcher: false, stdout: 'debug' },
  WorktreeRemove:     { matcher: false, stdout: 'debug' },
  PreCompact:         { matcher: ['manual', 'auto'], stdout: 'debug' },
  PostCompact:        { matcher: ['manual', 'auto'], stdout: 'debug' },
  PreModelSwitch:     { matcher: true, stdout: 'debug' },
  PostModelSwitch:    { matcher: true, stdout: 'context' },
  Elicitation:        { matcher: true, stdout: 'debug' },
  ElicitationResult:  { matcher: true, stdout: 'debug' },
  SessionEnd:         { matcher: ['clear', 'resume', 'logout', 'prompt_input_exit', 'other'], stdout: 'debug' },
};

/** Closest documented event name, for a typo. */
export function nearest(name) {
  const keys = Object.keys(EVENTS);
  const lower = String(name).toLowerCase();
  const exact = keys.find((k) => k.toLowerCase() === lower);
  if (exact) return exact;
  let best = null;
  let bestScore = Infinity;
  for (const k of keys) {
    const d = distance(lower, k.toLowerCase());
    if (d < bestScore) { bestScore = d; best = k; }
  }
  return bestScore <= Math.max(2, Math.ceil(lower.length / 4)) ? best : null;
}

function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length];
}
