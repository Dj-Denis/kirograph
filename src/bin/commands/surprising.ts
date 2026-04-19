import * as path from 'path';
import { Command } from 'commander';
import { bold, dim, reset, violet } from '../ui';

export function register(program: Command): void {
  program
    .command('surprising [projectPath]')
    .description('Find non-obvious cross-file connections between distant symbols')
    .option('--limit <n>', 'Max results (default: 20)', '20')
    .option('--format <fmt>', 'Output format: table | json', 'table')
    .action(async (projectPath: string | undefined, opts: { limit: string; format: string }) => {
      const KiroGraph = (await import('../../index')).default;
      const target = path.resolve(projectPath ?? process.cwd());
      const cg = await KiroGraph.open(target);
      const limit = Math.max(1, Math.min(100, parseInt(opts.limit) || 20));
      const connections = cg.findSurprisingConnections(limit);
      cg.close();

      if (connections.length === 0) {
        console.log(`\n  ${dim}No surprising cross-file connections found.${reset}\n`);
        return;
      }

      if (opts.format === 'json') {
        console.log(JSON.stringify(connections.map(c => ({
          source: { name: c.source.name, kind: c.source.kind, file: c.source.filePath },
          target: { name: c.target.name, kind: c.target.kind, file: c.target.filePath },
          kind: c.kind,
          score: c.score,
        })), null, 2));
        return;
      }

      console.log();
      console.log(`  ${violet}${bold}Surprising Connections${reset}  ${dim}non-obvious cross-file links${reset}\n`);

      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        const rank = String(i + 1).padStart(2);
        const score = c.score.toFixed(2);
        console.log(`  ${dim}${rank}.${reset} ${violet}${bold}${c.source.name}${reset}  ${dim}${c.source.kind}${reset}  ${dim}─[${c.kind}]→${reset}  ${violet}${bold}${c.target.name}${reset}  ${dim}${c.target.kind}${reset}  ${dim}score: ${score}${reset}`);
        console.log(`      ${dim}${c.source.filePath}${reset}`);
        console.log(`      ${dim}${c.target.filePath}${reset}`);
      }

      console.log(`\n  ${dim}${connections.length} result(s) — score = path distance × edge weight${reset}\n`);
    });
}
