/**
 * KiroGraph Snapshot Manager
 *
 * Saves lightweight graph snapshots (node IDs + edge tuples) to
 * .kirograph/snapshots/ and computes structural diffs between them.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GraphDatabase } from '../db/database';

export interface SnapshotNode {
  id: string;
  name: string;
  kind: string;
  filePath: string;
}

export interface SnapshotEdge {
  source: string;
  target: string;
  kind: string;
}

export interface GraphSnapshot {
  label: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
}

export interface GraphDiff {
  from: { label: string; timestamp: number };
  to: { label: string; timestamp: number };
  addedNodes: SnapshotNode[];
  removedNodes: SnapshotNode[];
  addedEdges: SnapshotEdge[];
  removedEdges: SnapshotEdge[];
}

const SNAPSHOTS_DIR = 'snapshots';

export class SnapshotManager {
  private readonly snapshotsDir: string;

  constructor(private readonly db: GraphDatabase, projectRoot: string) {
    this.snapshotsDir = path.join(projectRoot, '.kirograph', SNAPSHOTS_DIR);
  }

  private ensureDir(): void {
    fs.mkdirSync(this.snapshotsDir, { recursive: true });
  }

  save(label?: string): GraphSnapshot {
    this.ensureDir();
    const timestamp = Date.now();
    const snapshotLabel = label ?? new Date(timestamp).toISOString().slice(0, 19).replace(/[T:]/g, '-');

    const nodes: SnapshotNode[] = this.db.getAllNodes().map(n => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      filePath: n.filePath,
    }));
    const edges: SnapshotEdge[] = this.db.getAllEdges().map(e => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));

    const snapshot: GraphSnapshot = {
      label: snapshotLabel,
      timestamp,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
    };

    const filename = `${snapshotLabel}.json`;
    fs.writeFileSync(path.join(this.snapshotsDir, filename), JSON.stringify(snapshot));
    return snapshot;
  }

  list(): Array<{ label: string; timestamp: number; nodeCount: number; edgeCount: number }> {
    if (!fs.existsSync(this.snapshotsDir)) return [];
    return fs.readdirSync(this.snapshotsDir)
      .filter(f => f.endsWith('.json'))
      .flatMap(f => {
        try {
          const data: GraphSnapshot = JSON.parse(fs.readFileSync(path.join(this.snapshotsDir, f), 'utf8'));
          return [{ label: data.label, timestamp: data.timestamp, nodeCount: data.nodeCount, edgeCount: data.edgeCount }];
        } catch { return []; }
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  load(label: string): GraphSnapshot | null {
    const candidates = [
      path.join(this.snapshotsDir, `${label}.json`),
      path.join(this.snapshotsDir, label),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
      }
    }
    return null;
  }

  loadLatest(): GraphSnapshot | null {
    const all = this.list();
    return all.length > 0 ? this.load(all[0].label) : null;
  }

  currentSnapshot(): GraphSnapshot {
    const nodes: SnapshotNode[] = this.db.getAllNodes().map(n => ({
      id: n.id, name: n.name, kind: n.kind, filePath: n.filePath,
    }));
    const edges: SnapshotEdge[] = this.db.getAllEdges().map(e => ({
      source: e.source, target: e.target, kind: e.kind,
    }));
    return { label: 'current', timestamp: Date.now(), nodeCount: nodes.length, edgeCount: edges.length, nodes, edges };
  }

  diff(from: GraphSnapshot, to: GraphSnapshot): GraphDiff {
    const fromNodeIds = new Set(from.nodes.map(n => n.id));
    const toNodeIds = new Set(to.nodes.map(n => n.id));

    const addedNodes = to.nodes.filter(n => !fromNodeIds.has(n.id));
    const removedNodes = from.nodes.filter(n => !toNodeIds.has(n.id));

    const edgeKey = (e: SnapshotEdge) => `${e.source}|${e.target}|${e.kind}`;
    const fromEdgeKeys = new Set(from.edges.map(edgeKey));
    const toEdgeKeys = new Set(to.edges.map(edgeKey));

    const addedEdges = to.edges.filter(e => !fromEdgeKeys.has(edgeKey(e)));
    const removedEdges = from.edges.filter(e => !toEdgeKeys.has(edgeKey(e)));

    return {
      from: { label: from.label, timestamp: from.timestamp },
      to: { label: to.label, timestamp: to.timestamp },
      addedNodes,
      removedNodes,
      addedEdges,
      removedEdges,
    };
  }
}
