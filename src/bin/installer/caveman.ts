/**
 * KiroGraph — Caveman mode support
 *
 * Mode stored in .kirograph/config.json as `cavemanMode`.
 * Hook command: kirograph caveman --inject
 *   → reads config, prints rules to STDOUT
 *   → Kiro injects STDOUT into agent context on agentSpawn
 */

export type CavemanMode = 'off' | 'lite' | 'full' | 'ultra';

// ── Rules per level ───────────────────────────────────────────────────────────

export const CAVEMAN_RULES: Record<string, string> = {
  lite: `\
## Communication style: lite

Respond concisely. Omit filler words (just, really, basically, simply, actually).
Keep full sentences and articles. Remove pleasantries and hedging.
Preserve all code blocks, technical terms, file paths, and URLs unchanged.
Pattern: state the fact, then the next step.`,

  full: `\
## Communication style: full caveman

Drop articles (a, an, the). Use fragments. Short synonyms OK.
No filler (just, really, basically, simply, actually). No pleasantries.
No hedging ("I think", "it seems", "you might want to").
Preserve all code blocks, technical terms, file paths, URLs unchanged.
Pattern: [thing] [action] [reason]. [next step].
Example: "Bug in auth middleware. Token check use \`<\` not \`<=\`. Fix line 42."`,

  ultra: `\
## Communication style: ultra caveman

Max compression. Drop articles, conjunctions, filler. Use fragments only.
Abbreviate: DB, auth, req, res, fn, cfg, msg, err, impl, dep.
Use → for causality. Use + for "and". Omit subject when obvious.
No pleasantries. No hedging. No explanations unless asked.
Preserve code blocks, technical terms, file paths, URLs unchanged.
Pattern: [thing] → [action]. [fix].
Example: "auth middleware → token check \`<\` not \`<=\`. Fix L42."`,
};

// ── Hook definitions ──────────────────────────────────────────────────────────

const INJECT_CMD = 'kirograph caveman --inject 2>/dev/null || true';

export function buildCavemanHook(): object {
  return {
    name: 'KiroGraph Caveman Mode',
    version: '1.0.0',
    description: 'Injects caveman communication style rules into the agent context at session start.',
    when: { type: 'agentSpawn' },
    then: { type: 'runCommand', command: INJECT_CMD },
  };
}

export function buildCavemanCliHook(): { command: string } {
  return { command: INJECT_CMD };
}
