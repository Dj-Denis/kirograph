import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { dim, reset, green, label } from '../ui';
import { loadConfig } from '../../config';

// ── State helpers ──────────────────────────────────────────────────────────────

interface TsState { pid: number; apiPort: number; }
interface QdState { pid: number; port: number; }

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killState(stateFile: string, pid: number, label_: string, portLabel: string): void {
  let killed = false;
  if (isAlive(pid)) {
    try { process.kill(pid, 'SIGTERM'); killed = true; } catch { /* ignore */ }
  }
  try { fs.unlinkSync(stateFile); } catch { /* ignore */ }
  if (killed) {
    console.log(`  ${green}✓${reset} ${label('Stopped')} ${label_}  ${dim}(pid ${pid}, port ${portLabel})${reset}`);
  } else {
    console.log(`  ${dim}${label_} (pid ${pid}) was not running — state file cleaned up.${reset}`);
  }
}

/** Check if the Qdrant /dashboard endpoint returns something other than 404. */
function qdrantDashboardReachable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/dashboard`, res => {
      resolve(res.statusCode !== 404);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

// ── Engine-specific start logic ────────────────────────────────────────────────

async function startTypesense(target: string): Promise<void> {
  const kirographDir = path.join(target, '.kirograph');
  const stateFile    = path.join(kirographDir, 'typesense-server.json');
  const saved        = readJson<TsState>(stateFile);

  if (saved && isAlive(saved.pid)) {
    console.log(`\n  ${green}✓${reset} Typesense already running  ${dim}(pid ${saved.pid}, port ${saved.apiPort})${reset}`);
  } else {
    console.log();
    const { TypesenseIndex } = await import('../../vectors/typesense-index');
    const index = new TypesenseIndex(kirographDir);
    await index.initialize();
    if (!index.isAvailable()) {
      console.log(`  Typesense failed to start.\n`); return;
    }
    index.close();
  }

  const { openTypesenseDashboard } = await import('../installer/dashboard');
  await openTypesenseDashboard(target);
  console.log(`  ${dim}Press Ctrl+C to close the dashboard (Typesense keeps running — use ${reset}kg dashboard stop${dim} to shut it down).${reset}\n`);
  process.on('SIGINT', () => process.exit(0));
  // HTTP server keeps Node alive
}

async function startQdrant(target: string): Promise<void> {
  const kirographDir = path.join(target, '.kirograph');
  const stateFile    = path.join(kirographDir, 'qdrant-server.json');

  const { ensureQdrantUI, openQdrantDashboard } = await import('../installer/qdrant-dashboard');

  const uiReady = await ensureQdrantUI(target);
  if (!uiReady) { console.log(`  Could not download Qdrant Web UI.\n`); return; }

  const saved = readJson<QdState>(stateFile);
  if (saved && isAlive(saved.pid)) {
    const hasDashboard = await qdrantDashboardReachable(saved.port);
    if (hasDashboard) {
      console.log(`\n  ${green}✓${reset} Qdrant already running with dashboard  ${dim}(pid ${saved.pid}, port ${saved.port})${reset}`);
      await openQdrantDashboard(target);
      console.log(`  ${dim}Qdrant keeps running in the background — use ${reset}kg dashboard stop${dim} to shut it down.${reset}\n`);
      return;
    }
    // Running but without dashboard — restart
    try { process.kill(saved.pid, 'SIGTERM'); } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 400));
    try { fs.unlinkSync(stateFile); } catch { /* ignore */ }
  }

  console.log();
  const { QdrantIndex } = await import('../../vectors/qdrant-index');
  const index = new QdrantIndex(kirographDir);
  await index.initialize();
  if (!index.isAvailable()) { console.log(`  Qdrant failed to start.\n`); return; }
  index.close();

  await openQdrantDashboard(target);
  console.log(`  ${dim}Qdrant keeps running in the background — use ${reset}kg dashboard stop${dim} to shut it down.${reset}\n`);
}

// ── Stop logic ─────────────────────────────────────────────────────────────────

function stopTypesense(target: string): void {
  const stateFile = path.join(target, '.kirograph', 'typesense-server.json');
  const saved     = readJson<TsState>(stateFile);
  if (!saved) { console.log(`  ${dim}No running Typesense server found.${reset}`); return; }
  killState(stateFile, saved.pid, 'Typesense server', String(saved.apiPort));
}

function stopQdrant(target: string): void {
  const stateFile = path.join(target, '.kirograph', 'qdrant-server.json');
  const saved     = readJson<QdState>(stateFile);
  if (!saved) { console.log(`  ${dim}No running Qdrant server found.${reset}`); return; }
  killState(stateFile, saved.pid, 'Qdrant server', String(saved.port));
}

// ── Command registration ───────────────────────────────────────────────────────

export function register(program: Command): void {
  const cmd = program
    .command('dashboard [projectPath]')
    .description('Manage the engine dashboard (qdrant, typesense)');

  cmd.command('start [projectPath]')
    .description('Start the engine server (if not running) and open its dashboard')
    .action(async (projectPath: string | undefined) => {
      const target = path.resolve(projectPath ?? process.cwd());
      const config = await loadConfig(target);
      const engine = config.semanticEngine;

      if (engine === 'typesense') return startTypesense(target);
      if (engine === 'qdrant')    return startQdrant(target);

      console.log(`\n  ${dim}Dashboard not available for engine "${engine}". Use qdrant or typesense.${reset}\n`);
    });

  cmd.command('stop [projectPath]')
    .description('Stop the running engine server')
    .action(async (projectPath: string | undefined) => {
      const target = path.resolve(projectPath ?? process.cwd());
      const config = await loadConfig(target);
      const engine = config.semanticEngine;

      console.log();
      if (engine === 'typesense') { stopTypesense(target); console.log(); return; }
      if (engine === 'qdrant')    { stopQdrant(target);    console.log(); return; }

      console.log(`  ${dim}No dashboard engine active (current engine: "${engine}").${reset}\n`);
    });
}
