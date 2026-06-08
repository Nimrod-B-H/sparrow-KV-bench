import Redis from 'ioredis';

// ── Constants ──────────────────────────────────────────────────────────────────
const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;
const BATCH_SIZE = 10_000;

// ── Argument parsing ───────────────────────────────────────────────────────────
function parseN(args: string[]): number {
  const flagIndex = args.indexOf('--count');
  const raw = flagIndex !== -1 ? args[flagIndex + 1] : args[0];

  if (raw === undefined || raw.trim() === '') {
    console.error('[ERROR] Missing required argument: --count <N>');
    console.error('Usage: ts-node scripts/seed/seed-redis.ts --count <N>');
    process.exit(1);
  }

  const n = parseInt(raw, 10);

  if (isNaN(n) || !Number.isInteger(n) || n < 0 || String(n) !== raw.trim()) {
    console.error(`[ERROR] Invalid value for --count: "${raw}". Expected a non-negative integer.`);
    console.error('Usage: ts-node scripts/seed/seed-redis.ts --count <N>');
    process.exit(1);
  }

  return n;
}

// ── Summary output ─────────────────────────────────────────────────────────────
function printSummary(n: number, elapsedMs: number, throughput: number): void {
  const row = (label: string, value: string): string =>
    `│  ${label.padEnd(12)} : ${value.padEnd(29)}│`;

  console.log('');
  console.log('┌──────────────────────────────────────────────┐');
  console.log('│          Data Seeding Summary                 │');
  console.log('├──────────────────────────────────────────────┤');
  console.log(row('Keys seeded', n.toLocaleString()));
  console.log(row('Time', `${elapsedMs} ms`));
  console.log(row('Throughput', `${throughput.toLocaleString()} keys/sec`));
  console.log('└──────────────────────────────────────────────┘');
  console.log('');
}

// ── Exported seeding function — throws on error ────────────────────────────────
export async function seedRedis(n: number, silent = false): Promise<{ elapsedMs: number; throughput: number }> {
  const log = (msg: string) => { if (!silent) console.log(msg); };
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true });

  try {
    await redis.connect().catch(() => {
      throw new Error(`Cannot connect to Redis on ${REDIS_HOST}:${REDIS_PORT}. Is Redis running?`);
    });

    log('[INFO]  Flushing keyspace...');
    await redis.flushdb();
    log('[INFO]  Keyspace flushed.');

    if (n === 0) {
      log('[INFO]  N=0. Nothing to seed.');
      return { elapsedMs: 0, throughput: 0 };
    }

    log(`[INFO]  Seeding ${n.toLocaleString()} keys in batches of ${BATCH_SIZE.toLocaleString()}...`);
    const startMs = Date.now();

    for (let batchStart = 0; batchStart < n; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, n);
      const pipeline = redis.pipeline();

      for (let i = batchStart; i < batchEnd; i++) {
        const key = Buffer.allocUnsafe(4);
        key.writeUInt32BE(i, 0);
        pipeline.set(key, '1');
      }

      const results = await pipeline.exec();

      if (results === null) {
        throw new Error(`Pipeline returned null on batch starting at index ${batchStart}.`);
      }

      for (const [err] of results) {
        if (err) throw new Error(`Pipeline error on batch starting at index ${batchStart}: ${err.message}`);
      }

      if (!silent) {
        const pct = Math.round((batchEnd / n) * 100);
        process.stdout.write(`\r[INFO]  Progress: ${batchEnd.toLocaleString()} / ${n.toLocaleString()} keys (${pct}%)`);
      }
    }

    if (!silent) process.stdout.write('\n');

    const elapsedMs = Date.now() - startMs;

    log('[INFO]  Verifying keyspace size...');
    const dbSize = await redis.dbsize();

    if (dbSize !== n) {
      throw new Error(`DBSIZE mismatch. Expected: ${n.toLocaleString()}, Actual: ${dbSize.toLocaleString()}`);
    }

    log(`[INFO]  Verification passed. DBSIZE = ${dbSize.toLocaleString()}`);

    const throughput = elapsedMs > 0 ? Math.round(n / (elapsedMs / 1000)) : 0;
    return { elapsedMs, throughput };

  } finally {
    redis.disconnect();
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────────
if (require.main === module) {
  const n = parseN(process.argv.slice(2));
  seedRedis(n, false)
    .then(({ elapsedMs, throughput }) => printSummary(n, elapsedMs, throughput))
    .catch(err => {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    });
}
