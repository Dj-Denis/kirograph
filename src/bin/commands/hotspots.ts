import * as path from 'path';
import { Command } from 'commander';
import { bold, dim, green, reset, violet } from '../ui';

export function register(program: Command): void {
  program
    .command('hotspots [projectPath]')
    .description('Find the most-connected symbols by edge degree')
    .option('--limit <n>', 'Max results (default: 20)', '20')
    .option('--format <fmt>', 'Output format: table | json', 'table')
    .action(async (projectPath: string | undefined, opts: { limit: string; format: string }) => {
      const KiroGraph = (await import('../../index')).default;
      const target = path.resolve(projectPath ?? process.cwd());
      const cg = await KiroGraph.open(target);
      const limit = Math.max(1, Math.min(100, parseInt(opts.limit) || 20));
      const hotspots = cg.findHotspots(limit);
      cg.close();

      if (hotspots.length === 0) {
        console.log(`\n  ${dim}No symbols found in index.${reset}\n`);
        return;
      }

      if (opts.format === 'json') {
        console.log(JSON.stringify(hotspots, null, 2));
        return;
      }

      console.log();
      console.log(`  ${violet}${bold}Hotspots${reset}  ${dim}most-connected symbols${reset}\n`);

      const maxDegree = hotspots[0].degree;
      const BAR_WIDTH = 20;

      for (let i = 0; i < hotspots.length; i++) {
        const n = hotspots[i];
        const rank = String(i + 1).padStart(2);
        const bar = Math.round((n.degree / maxDegree) * BAR_WIDTH);
        const barStr = '█'.repeat(bar) + '░'.repeat(BAR_WIDTH - bar);
        console.log(`  ${dim}${rank}.${reset} ${violet}${bold}${n.name}${reset}  ${dim}${n.kind}${reset}`);
        console.log(`      ${violet}${barStr}${reset}  ${bold}${n.degree}${reset}${dim} edges (↑${n.inDegree} ↓${n.outDegree})${reset}`);
        console.log(`      ${dim}${n.filePath}:${n.startLine}${reset}`);
      }

      console.log(`\n  ${dim}${hotspots.length} result(s)${reset}\n`);
    });
}
