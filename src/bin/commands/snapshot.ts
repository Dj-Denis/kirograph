import * as path from 'path';
import { Command } from 'commander';
import { bold, dim, green, reset, violet } from '../ui';

export function register(program: Command): void {
  const snapshotCmd = program
    .command('snapshot')
    .description('Save or list graph snapshots for later diffing');

  // kirograph snapshot save [label] [projectPath]
  snapshotCmd
    .command('save [label]')
    .description('Save a snapshot of the current graph state')
    .option('--path <p>', 'Project root path')
    .action(async (label: string | undefined, opts: { path?: string }) => {
      const KiroGraph = (await import('../../index')).default;
      const target = path.resolve(opts.path ?? process.cwd());
      const cg = await KiroGraph.open(target);
      const sm = cg.createSnapshotManager();
      const snapshot = sm.save(label);
      cg.close();
      console.log();
      console.log(`  ${green}✓${reset} Snapshot saved: ${violet}${bold}${snapshot.label}${reset}`);
      console.log(`  ${dim}${snapshot.nodeCount} symbols, ${snapshot.edgeCount} edges${reset}`);
      console.log();
    });

  // kirograph snapshot list [projectPath]
  snapshotCmd
    .command('list')
    .description('List saved snapshots')
    .option('--path <p>', 'Project root path')
    .action(async (opts: { path?: string }) => {
      const KiroGraph = (await import('../../index')).default;
      const target = path.resolve(opts.path ?? process.cwd());
      const cg = await KiroGraph.open(target);
      const sm = cg.createSnapshotManager();
      const snapshots = sm.list();
      cg.close();

      if (snapshots.length === 0) {
        console.log(`\n  ${dim}No snapshots yet. Run \`kirograph snapshot save\` first.${reset}\n`);
        return;
      }

      console.log();
      console.log(`  ${violet}${bold}Snapshots${reset}\n`);
      for (const s of snapshots) {
        const date = new Date(s.timestamp).toISOString().slice(0, 19).replace('T', ' ');
        console.log(`  ${violet}${bold}${s.label}${reset}  ${dim}${date}  ${s.nodeCount} symbols, ${s.edgeCount} edges${reset}`);
      }
      console.log();
    });

  // kirograph snapshot diff [label] [projectPath]
  snapshotCmd
    .command('diff [label]')
    .description('Diff current graph vs a saved snapshot (defaults to latest)')
    .option('--path <p>', 'Project root path')
    .option('--format <fmt>', 'Output format: summary | full | json', 'summary')
    .action(async (label: string | undefined, opts: { path?: string; format: string }) => {
      const KiroGraph = (await import('../../index')).default;
      const target = path.resolve(opts.path ?? process.cwd());
      const cg = await KiroGraph.open(target);
      const sm = cg.createSnapshotManager();

      const snapshot = label ? sm.load(label) : sm.loadLatest();
      if (!snapshot) {
        console.log(`\n  ${dim}${label ? `Snapshot "${label}" not found.` : 'No snapshots found. Run `kirograph snapshot save` first.'} ${reset}\n`);
        cg.close();
        return;
      }

      const diff = sm.diff(snapshot, sm.currentSnapshot());
      cg.close();

      if (opts.format === 'json') {
        console.log(JSON.stringify(diff, null, 2));
        return;
      }

      const fromDate = new Date(diff.from.timestamp).toISOString().slice(0, 19).replace('T', ' ');
      console.log();
      console.log(`  ${violet}${bold}Graph Diff${reset}  ${dim}"${diff.from.label}" (${fromDate}) → current${reset}\n`);
      console.log(`  ${green}+${reset} ${bold}${diff.addedNodes.length}${reset}${dim} symbols added${reset}    ${dim}-${reset} ${bold}${diff.removedNodes.length}${reset}${dim} symbols removed${reset}`);
      console.log(`  ${green}+${reset} ${bold}${diff.addedEdges.length}${reset}${dim} edges added${reset}      ${dim}-${reset} ${bold}${diff.removedEdges.length}${reset}${dim} edges removed${reset}`);

      if (opts.format === 'full') {
        if (diff.addedNodes.length > 0) {
          console.log(`\n  ${dim}Added symbols:${reset}`);
          for (const n of diff.addedNodes.slice(0, 50)) {
            console.log(`    ${green}+${reset} ${violet}${n.name}${reset}  ${dim}${n.kind}  ${n.filePath}${reset}`);
          }
          if (diff.addedNodes.length > 50) console.log(`    ${dim}…and ${diff.addedNodes.length - 50} more${reset}`);
        }
        if (diff.removedNodes.length > 0) {
          console.log(`\n  ${dim}Removed symbols:${reset}`);
          for (const n of diff.removedNodes.slice(0, 50)) {
            console.log(`    ${dim}- ${n.name}  ${n.kind}  ${n.filePath}${reset}`);
          }
          if (diff.removedNodes.length > 50) console.log(`    ${dim}…and ${diff.removedNodes.length - 50} more${reset}`);
        }
      }

      console.log();
    });
}
