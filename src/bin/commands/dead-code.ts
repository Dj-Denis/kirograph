import * as path from 'path';
import { Command } from 'commander';
import { bold, dim, reset, violet } from '../ui';

export function register(program: Command): void {
  program
    .command('dead-code [projectPath]')
    .description('Find unexported symbols with no incoming references')
    .option('--limit <n>', 'Max results (default: 50)', '50')
    .option('--format <fmt>', 'Output format: table | json', 'table')
    .action(async (projectPath: string | undefined, opts: { limit: string; format: string }) => {
      const KiroGraph = (await import('../../index')).default;
      const target = path.resolve(projectPath ?? process.cwd());
      const cg = await KiroGraph.open(target);
      const limit = Math.max(1, Math.min(100, parseInt(opts.limit) || 50));
      const dead = cg.findDeadCode(limit);
      cg.close();

      if (dead.length === 0) {
        console.log(`\n  ${dim}No dead code detected.${reset}\n`);
        return;
      }

      if (opts.format === 'json') {
        console.log(JSON.stringify(dead, null, 2));
        return;
      }

      console.log();
      console.log(`  ${violet}${bold}Dead Code${reset}  ${dim}unexported symbols with no incoming references${reset}\n`);

      // Group by file for readability
      const byFile = new Map<string, typeof dead>();
      for (const n of dead) {
        if (!byFile.has(n.filePath)) byFile.set(n.filePath, []);
        byFile.get(n.filePath)!.push(n);
      }

      for (const [file, nodes] of byFile) {
        console.log(`  ${dim}${file}${reset}`);
        for (const n of nodes) {
          console.log(`    ${violet}${bold}${n.name}${reset}  ${dim}${n.kind}  line ${n.startLine}${reset}`);
        }
      }

      console.log(`\n  ${dim}${dead.length} result(s)${reset}\n`);
    });
}
