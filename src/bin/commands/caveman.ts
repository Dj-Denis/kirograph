/**
 * kg caveman [off|lite|full|ultra]   — set caveman mode for this project
 * kg caveman --inject                — print rules to stdout (used by agentSpawn hook)
 * kg caveman                        — show current mode
 */

import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config';
import { CAVEMAN_RULES, CavemanMode } from '../installer/caveman';
import { writeSteering } from '../installer/steering';

export function register(program: Command): void {
  program
    .command('caveman [mode]')
    .description('Set caveman communication style for the Kiro agent (off | lite | full | ultra)')
    .option('--inject', 'Print rules to stdout for hook injection (used internally by agentSpawn)')
    .action(async (mode: string | undefined, opts: { inject?: boolean }) => {
      const cwd = process.cwd();

      // --inject: read config, print rules to stdout, exit silently
      if (opts.inject) {
        try {
          const config = await loadConfig(cwd);
          const m = config.cavemanMode;
          if (m && m !== 'off' && CAVEMAN_RULES[m]) {
            process.stdout.write(CAVEMAN_RULES[m] + '\n');
          }
        } catch { /* no .kirograph/ — no output */ }
        return;
      }

      // No mode argument: show current status
      if (!mode) {
        try {
          const config = await loadConfig(cwd);
          console.log(`  Caveman mode: ${config.cavemanMode ?? 'off'}`);
        } catch {
          console.log('  Caveman mode: off (no .kirograph/config.json found)');
        }
        console.log();
        console.log('  Available modes:');
        console.log('    off    — normal responses');
        console.log('    lite   — compact, no filler, full sentences');
        console.log('    full   — fragments, no articles, short synonyms');
        console.log('    ultra  — maximum compression, abbreviations, → for causality');
        console.log();
        console.log('  Change: kg caveman <mode>');
        return;
      }

      const normalized = mode.toLowerCase();
      const valid = ['off', 'lite', 'full', 'ultra'];
      if (!valid.includes(normalized)) {
        console.error(`  Unknown mode: ${mode}. Choose from: off, lite, full, ultra`);
        process.exit(1);
      }

      await updateConfig(cwd, { cavemanMode: normalized as CavemanMode | 'off' });

      // Regenerate steering file if .kiro/steering/kirograph.md exists
      const steeringPath = path.join(cwd, '.kiro', 'steering', 'kirograph.md');
      if (fs.existsSync(steeringPath)) {
        writeSteering(path.join(cwd, '.kiro'), normalized as CavemanMode | 'off');
      }

      if (normalized === 'off') {
        console.log('  Caveman mode off. Agent will respond normally from next session.');
      } else {
        console.log(`  Caveman mode set to: ${normalized}`);
        console.log('  Takes effect on next agent session (agentSpawn).');
        console.log();
        console.log('  Rules preview:\n');
        console.log(CAVEMAN_RULES[normalized].split('\n').map((l: string) => `    ${l}`).join('\n'));
      }
    });
}
