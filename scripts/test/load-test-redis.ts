import Redis from 'ioredis';
import { Worker } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { performance } from 'perf_hooks';
import { seedRedis } from '../seed/seed-redis';

// ── Types ──────────────────────────────────────────────────────────────────────
interface TelemetrySample { ts_ms: number; cpu_pct: number; rss_mb: number; }
interface LatencyStats    { p50: number; p95: number; p99: number; max: number; }
interface ErrorSummary    { count: number; types: Record<string, number>; }

interface TierResult {
  C: number;
  ops_total: number;
  duration_ms: number;
  throughput_ops_sec: number;
  latency: LatencyStats;
  errors: ErrorSummary;
  telemetry: TelemetrySample[];
}

interface RunResult  { N: number; seed_ms: number; concurrency_tiers: TierResult[]; }

interface SpikeResult {
  N: number;
  from_C: number;
  to_C: number;
  stable: boolean;
  duration_ms: number;
  latency: LatencyStats;
  errors: ErrorSummary;
  telemetry: TelemetrySample[];
}

interface Report {
  meta: {
    timestamp: string;
    redis_version: string;
    ratio: string;
    host: string;
  };
  runs: RunResult[];
  spike: SpikeResult;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const REDIS_HOST   = '127.0.0.1';
const REDIS_PORT   = 6379;
const N_VALUES     = [100, 10_000, 1_000_000];
const C_TIERS      = [10, 100];
const SPIKE_N      = 1_000_000;
const SPIKE_FROM_C = 100;
const SPIKE_TO_C   = 1_000;
const SPIKE_OPS    = 10_000;

// ── Argument parsing ───────────────────────────────────────────────────────────
function parseRatio(args: string[]): number {
  const idx = args.indexOf('--ratio');
  const str = idx !== -1 ? args[idx + 1] : '80:20';
  const getPct = parseInt((str ?? '80:20').split(':')[0], 10);
  if (isNaN(getPct) || getPct < 0 || getPct > 100) {
    throw new Error(`Invalid --ratio "${str}". Expected format: "80:20".`);
  }
  return getPct;
}

// ── Key generation ─────────────────────────────────────────────────────────────
// GET keys: seeded range [0, N-1] — always present
function getKey(N: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(Math.floor(Math.random() * N), 0);
  return buf;
}

// SET keys: range [N, 2N-1] — separate throwaway keyspace, never pollutes seeded data
function setKey(N: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(N + Math.floor(Math.random() * N), 0);
  return buf;
}

// ── Latency percentiles ────────────────────────────────────────────────────────
function computePercentiles(latencies: number[]): LatencyStats {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const s = [...latencies].sort((a, b) => a - b);
  const at = (p: number) => +s[Math.min(Math.floor(s.length * p), s.length - 1)].toFixed(2);
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: +s[s.length - 1].toFixed(2) };
}

// ── Error summary ──────────────────────────────────────────────────────────────
function toErrorSummary(codes: string[]): ErrorSummary {
  const types: Record<string, number> = {};
  for (const c of codes) types[c] = (types[c] ?? 0) + 1;
  return { count: codes.length, types };
}

// ── Client management ──────────────────────────────────────────────────────────
const CLIENT_CFG = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 3_000,
  enableOfflineQueue: false,
};

async function createClients(C: number): Promise<Redis[]> {
  const settled = await Promise.allSettled(
    Array.from({ length: C }, async () => {
      const c = new Redis(CLIENT_CFG);
      await c.connect();
      return c;
    }),
  );

  const clients = settled
    .filter((r): r is PromiseFulfilledResult<Redis> => r.status === 'fulfilled')
    .map(r => r.value);

  if (clients.length < Math.ceil(C * 0.9)) {
    await destroyClients(clients);
    throw new Error(`Only ${clients.length}/${C} clients connected. Check Redis maxclients.`);
  }

  return clients;
}

async function destroyClients(clients: Redis[]): Promise<void> {
  await Promise.all(clients.map(c => c.quit().catch(() => c.disconnect())));
}

// ── Telemetry worker ───────────────────────────────────────────────────────────
// Uses eval-based Worker to avoid ts-node / worker_threads compatibility issues.
// Samples host CPU (via os.cpus() delta) and process RSS every 200ms.
const WORKER_CODE = `
const { parentPort } = require('worker_threads');
const os = require('os');
let timer = null, startTime = Date.now();

function snap() {
  let idle = 0, total = 0;
  for (const cpu of os.cpus()) {
    for (const [k, v] of Object.entries(cpu.times)) {
      total += v;
      if (k === 'idle') idle += v;
    }
  }
  return { idle, total };
}

let prev = snap();

parentPort.on('message', (msg) => {
  if (msg === 'start') {
    startTime = Date.now();
    prev = snap();
    timer = setInterval(() => {
      const curr = snap();
      const d = curr.total - prev.total;
      const cpuPct = d === 0 ? 0 : +((1 - (curr.idle - prev.idle) / d) * 100).toFixed(1);
      prev = curr;
      parentPort.postMessage({
        ts_ms: Date.now() - startTime,
        cpu_pct: cpuPct,
        rss_mb: +(process.memoryUsage().rss / 1048576).toFixed(1),
      });
    }, 200);
  } else if (msg === 'stop') {
    clearInterval(timer);
    parentPort.postMessage('done');
  }
});
`;

function startWorker(): { worker: Worker; samples: TelemetrySample[] } {
  const samples: TelemetrySample[] = [];
  const worker = new Worker(WORKER_CODE, { eval: true });
  worker.on('message', (m: TelemetrySample | 'done') => {
    if (m !== 'done') samples.push(m);
  });
  worker.postMessage('start');
  return { worker, samples };
}

function stopWorker(worker: Worker, samples: TelemetrySample[]): Promise<TelemetrySample[]> {
  return new Promise(resolve => {
    worker.once('message', (m: unknown) => {
      if (m === 'done') resolve([...samples]);
    });
    worker.postMessage('stop');
  });
}

// ── Per-client operation runner ────────────────────────────────────────────────
async function runClientOps(
  client: Redis,
  count: number,
  N: number,
  getPct: number,
): Promise<{ latencies: number[]; errors: string[] }> {
  const latencies: number[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = performance.now();
    try {
      if (Math.random() * 100 < getPct) {
        await client.get(getKey(N));
      } else {
        await client.set(setKey(N), '1');
      }
      latencies.push(performance.now() - t);
    } catch (e) {
      errors.push((e as NodeJS.ErrnoException).code ?? 'UNKNOWN');
    }
  }

  return { latencies, errors };
}

// ── Concurrency tier runner ────────────────────────────────────────────────────
async function runTier(N: number, C: number, ops: number, getPct: number): Promise<TierResult> {
  const clients = await createClients(C);
  const { worker, samples } = startWorker();
  const opsPerClient = Math.ceil(ops / C);

  const start = performance.now();
  const results = await Promise.all(clients.map(c => runClientOps(c, opsPerClient, N, getPct)));
  const duration_ms = Math.round(performance.now() - start);

  const telemetry = await stopWorker(worker, samples);
  await destroyClients(clients);

  const allLat = results.flatMap(r => r.latencies);
  const allErr = results.flatMap(r => r.errors);
  const ops_total = allLat.length + allErr.length;

  return {
    C,
    ops_total,
    duration_ms,
    throughput_ops_sec: duration_ms > 0 ? Math.round(ops_total / (duration_ms / 1000)) : 0,
    latency: computePercentiles(allLat),
    errors: toErrorSummary(allErr),
    telemetry,
  };
}

// ── Spike runner ───────────────────────────────────────────────────────────────
async function runSpike(N: number, getPct: number): Promise<SpikeResult> {
  // Establish from_C connections then immediately tear down (simulates active pool teardown)
  const warmup = await createClients(SPIKE_FROM_C);
  await destroyClients(warmup);

  // Spike: immediately create to_C connections and fire ops
  const clients = await createClients(SPIKE_TO_C);
  const { worker, samples } = startWorker();
  const opsPerClient = Math.ceil(SPIKE_OPS / clients.length);

  const start = performance.now();
  let rawResults: Awaited<ReturnType<typeof runClientOps>>[] = [];
  let fatalErr: string | null = null;

  try {
    rawResults = await Promise.all(clients.map(c => runClientOps(c, opsPerClient, N, getPct)));
  } catch (e) {
    fatalErr = (e as NodeJS.ErrnoException).code ?? 'UNKNOWN';
  }

  const duration_ms = Math.round(performance.now() - start);
  const telemetry = await stopWorker(worker, samples);
  await destroyClients(clients);

  const allLat = rawResults.flatMap(r => r.latencies);
  const allErr = rawResults.flatMap(r => r.errors);
  if (fatalErr) allErr.push(fatalErr);

  const total = allLat.length + allErr.length;
  const stable = total === 0 ? false : allErr.length / total < 0.1;

  return {
    N,
    from_C: SPIKE_FROM_C,
    to_C: SPIKE_TO_C,
    stable,
    duration_ms,
    latency: computePercentiles(allLat),
    errors: toErrorSummary(allErr),
    telemetry,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getPct = parseRatio(args);

  console.log('[INFO]  === Redis Load Test Runner ===');
  console.log(`[INFO]  GET:SET ratio=${getPct}:${100 - getPct} | N=${N_VALUES.join(', ')} | C=${C_TIERS.join(', ')}`);

  // Probe Redis version
  const probe = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
  const serverInfo = await probe.info('server');
  const redisVersion = serverInfo.match(/redis_version:([^\r\n]+)/)?.[1]?.trim() ?? 'unknown';
  await probe.quit();
  console.log(`[INFO]  Redis version: ${redisVersion}`);

  const timestamp = new Date().toISOString();
  const runs: RunResult[] = [];

  for (const N of N_VALUES) {
    console.log(`\n[INFO]  ── Dataset N=${N.toLocaleString()} ──`);

    const seedStart = Date.now();
    await seedRedis(N, true);
    const seed_ms = Date.now() - seedStart;
    console.log(`[INFO]  Seeded ${N.toLocaleString()} keys in ${seed_ms} ms.`);

    const concurrency_tiers: TierResult[] = [];

    for (const C of C_TIERS) {
      process.stdout.write(`[INFO]  Running C=${C}...`);
      const tier = await runTier(N, C, C * 100, getPct);
      process.stdout.write(` ${tier.throughput_ops_sec.toLocaleString()} ops/sec | P99=${tier.latency.p99} ms | errors=${tier.errors.count}\n`);
      concurrency_tiers.push(tier);
    }

    runs.push({ N, seed_ms, concurrency_tiers });
  }

  // Spike test
  console.log(`\n[INFO]  ── Concurrency Spike C=${SPIKE_FROM_C}→${SPIKE_TO_C} on N=${SPIKE_N.toLocaleString()} ──`);
  await seedRedis(SPIKE_N, true);
  const spike = await runSpike(SPIKE_N, getPct);
  console.log(`[INFO]  Spike: stable=${spike.stable} | P99=${spike.latency.p99} ms | errors=${spike.errors.count}`);

  // Write report
  const report: Report = {
    meta: {
      timestamp,
      redis_version: redisVersion,
      ratio: `${getPct}:${100 - getPct}`,
      host: os.hostname(),
    },
    runs,
    spike,
  };

  fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
  const filename = path.join('reports', `redis-${timestamp.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));

  console.log(`\n[INFO]  Report written to ${filename}`);
  console.log('[INFO]  === Load test complete ===');
}

main().catch(err => {
  console.error(`[ERROR] ${err.message}`);
  process.exit(1);
});
