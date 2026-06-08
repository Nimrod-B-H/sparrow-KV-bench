# Redis Load Testing

## Overview

`scripts/test/load-test-redis.ts` runs a full concurrency load test against a pre-populated Redis 8.8.0 instance.

It seeds the database before each dataset tier using `seed-redis.ts`, executes GET and SET operations across all N×C combinations, samples CPU and memory via a worker thread every 200ms, and writes a single JSON report to `reports/`.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Redis | 8.8.0 running on `127.0.0.1:6379` |
| Node.js | >= 20.0.0 |
| pnpm | >= 10.0.0 |
| Dependencies installed | Run `pnpm install` first |
| Seeder available | `scripts/seed/seed-redis.ts` must be present |

Provision Redis first if not already running:

```bash
sudo ./scripts/setup/provision-redis.sh
```

---

## Usage

```bash
# Default run (80:20 GET:SET ratio)
./node_modules/.bin/ts-node scripts/test/load-test-redis.ts

# Custom GET:SET ratio
./node_modules/.bin/ts-node scripts/test/load-test-redis.ts --ratio 50:50
```

---

## Flags

| Flag | Default | Description |
|---|---|---|
| `--ratio <GET:SET>` | `80:20` | Percentage split between GET and SET operations per tier. Must sum to 100. |

---

## What the Script Does

| Step | Description |
|---|---|
| Redis version probe | Connects and reads `redis_version` from `INFO server` |
| Dataset seeding | Calls `seedRedis(N)` before each N tier — always flushes and re-seeds |
| Concurrency tiers | For each N×C combination, creates C connections, fires C×100 ops via `Promise.all` |
| Connection isolation | Tears down and re-creates all C connections between tiers |
| GET operations | Random key from seeded range `[0, N-1]` — key always exists |
| SET operations | Random key above `[N, 2N-1]` — separate throwaway keyspace, never pollutes seeded data |
| Latency capture | Sub-millisecond precision via `perf_hooks.performance.now()` |
| Percentile calculation | P50, P95, P99, max computed from all operation timings per tier |
| CPU/memory telemetry | Worker thread samples `os.cpus()` delta and `process.memoryUsage().rss` every 200ms |
| Concurrency spike | After all tiers, runs C=100→1,000 burst on N=1,000,000 as a separate stress test |
| JSON report | Written to `reports/redis-<ISO-timestamp>.json` — one file per run |

---

## Test Matrix

| N | C | Ops per tier |
|---|---|---|
| 100 | 10 | 1,000 |
| 100 | 100 | 10,000 |
| 10,000 | 10 | 1,000 |
| 10,000 | 100 | 10,000 |
| 1,000,000 | 10 | 1,000 |
| 1,000,000 | 100 | 10,000 |

Plus a concurrency spike (C=100→1,000, 10,000 ops) on N=1,000,000.

---

## Report Format

Reports are written to `reports/` named `redis-<ISO-timestamp>.json`.

The JSON structure is:

```json
{
  "meta": {
    "timestamp": "<ISO>",
    "redis_version": "8.8.0",
    "ratio": "80:20",
    "host": "<hostname>"
  },
  "runs": [
    {
      "N": 100,
      "seed_ms": 505,
      "concurrency_tiers": [
        {
          "C": 10,
          "ops_total": 1000,
          "duration_ms": 253,
          "throughput_ops_sec": 3953,
          "latency": { "p50": 2.1, "p95": 12.4, "p99": 44.36, "max": 61.2 },
          "errors": { "count": 0, "types": {} },
          "telemetry": [
            { "ts_ms": 200, "cpu_pct": 14.2, "rss_mb": 78.4 }
          ]
        }
      ]
    }
  ],
  "spike": {
    "N": 1000000,
    "from_C": 100,
    "to_C": 1000,
    "stable": true,
    "duration_ms": 4821,
    "latency": { "p50": 42.1, "p95": 98.3, "p99": 130.38, "max": 210.5 },
    "errors": { "count": 0, "types": {} },
    "telemetry": []
  }
}
```

Generated JSON files are excluded from git via `.gitignore`. The `reports/` directory is tracked via `.gitkeep`.

---

## First Run Baseline

Recorded on 2026-06-08 on host `BaliShag` (Apple M-series, macOS, Redis 8.8.0 via Homebrew).  
Ratio: 80:20 GET:SET. These are local development baselines, not production benchmarks.

### Throughput and Latency by N and C

| N | C | Throughput (ops/sec) | P99 (ms) | Errors |
|---|---|---|---|---|
| 100 | 10 | 3,953 | 44.36 | 0 |
| 100 | 100 | 15,221 | 26.77 | 0 |
| 10,000 | 10 | 5,587 | 14.81 | 0 |
| 10,000 | 100 | 15,314 | 16.53 | 0 |
| 1,000,000 | 10 | 6,579 | 41.02 | 0 |
| 1,000,000 | 100 | 16,611 | 20.00 | 0 |

### Concurrency Spike (C=100→1,000, N=1,000,000)

| Metric | Value |
|---|---|
| Stable | true |
| P99 latency | 130.38 ms |
| Errors | 0 |

If your results are significantly lower, check Redis connectivity, available memory, and whether another process is competing on the same machine.

---

## Error Codes

The script exits with code `1` for:

- Invalid `--ratio` argument
- Cannot connect to Redis to read version info
- Seeding failure for any N tier

Individual tier errors (e.g. `ECONNREFUSED`, `ETIMEDOUT`) are caught, counted, and written to the report without crashing the runner.

---

## Troubleshooting

**Cannot connect to Redis**  
Run `redis-cli ping`. If it fails, provision Redis first: `./scripts/setup/provision-redis.sh`.

**Very low throughput**  
Check `redis-cli INFO stats` for rejected connections. Redis default `maxclients` is 10,000 — the spike tier uses 1,000 connections which is safe but worth confirming on constrained systems.

**High P99 on N=100**  
Expected — at low N the working set fits in L1 cache, but loopback socket latency dominates at C=10. Throughput and P99 stabilise as C increases.

---

## Related Files

| File | Purpose |
|---|---|
| `scripts/test/load-test-redis.ts` | The load test runner |
| `scripts/seed/seed-redis.ts` | Seeder called before each N tier |
| `scripts/setup/provision-redis.sh` | Redis provisioning — run this first |
| `specs/high-concurrency-load-testing/high-concurrency-load-testing.feature` | BDD specification this script implements |
| `docs/seed/seed-redis.md` | Seeder usage and baseline reference |
| `reports/` | Generated JSON reports (excluded from git) |
