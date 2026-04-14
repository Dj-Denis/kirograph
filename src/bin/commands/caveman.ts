/**
 * kg caveman [off|lite|full|ultra]   — set caveman mode for this project
 * kg caveman                        — show current mode
 */

import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config';
import { CAVEMAN_RULES, CavemanMode } from '../installer/caveman';
import { writeSteering } from '../installer/steering';
import { writeCliAgent } from '../installer/cli-agent';

export function register(program: Command): void {
  program
    .command('caveman [mode]')
    .description('Set caveman communication style for the Kiro agent (off | lite | full | ultra)')
    .action(async (mode: string | undefined) => {
      const cwd = process.cwd();

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

      const kiroDir = path.join(cwd, '.kiro');

      // Regenerate steering file if .kiro/steering/kirograph.md exists
      const steeringPath = path.join(kiroDir, 'steering', 'kirograph.md');
      if (fs.existsSync(steeringPath)) {
        writeSteering(kiroDir, normalized as CavemanMode | 'off');
      }

      // Regenerate CLI agent config if .kiro/agents/kirograph.json exists
      const agentPath = path.join(kiroDir, 'agents', 'kirograph.json');
      if (fs.existsSync(agentPath)) {
        writeCliAgent(kiroDir, normalized as CavemanMode | 'off');
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
