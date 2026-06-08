# Redis Data Seeding Script

## Overview

`scripts/seed/seed-redis.ts` populates a Redis 8.8.0 instance with N keys before a benchmark run.

It always flushes the target keyspace before seeding, ensuring a clean and reproducible state. It is a prerequisite for any concurrency or throughput test run.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Redis | 8.8.0 running on `127.0.0.1:6379` |
| Node.js | >= 20.0.0 |
| pnpm | >= 10.0.0 |
| Dependencies installed | Run `pnpm install` first |

---

## Usage

```bash
./node_modules/.bin/ts-node scripts/seed/seed-redis.ts --count <N>
```

Or via the package script:

```bash
pnpm seed -- --count <N>
```

### Examples

```bash
# Seed 100 keys
pnpm seed -- --count 100

# Seed 10,000 keys
pnpm seed -- --count 10000

# Seed 1,000,000 keys
pnpm seed -- --count 1000000

# Flush only, no keys
pnpm seed -- --count 0
```

---

## Flags

| Flag | Required | Description |
|---|---|---|
| `--count <N>` | Yes | Number of keys to seed. Must be a non-negative integer. |

---

## What the Script Does

| Step | Description |
|---|---|
| Argument validation | Parses and validates `--count N`. Exits with a usage message if missing or invalid. |
| Redis connection | Connects to `127.0.0.1:6379`. Exits with an error if Redis is not reachable. |
| FLUSHDB | Wipes the current database before every run to guarantee a clean state. |
| Key generation | Generates keys as 4-byte big-endian unsigned 32-bit integers (`Buffer.writeUInt32BE`). |
| Batched pipeline insertion | Sends keys in batches of 10,000 using `ioredis` pipeline to avoid memory buffer overflows. |
| Progress reporting | Prints a live progress line to stdout during seeding. |
| DBSIZE verification | After seeding, calls `DBSIZE` and asserts it equals N. Exits with an error if there is a mismatch. |
| Summary output | Prints a structured summary block with keys seeded, total time, and throughput. |

---

## Key Encoding Contract

Every key is exactly 4 bytes — a 32-bit big-endian unsigned integer representation of its index `i`, where `i` ranges from `0` to `N-1`.

```
Key for i=0:   \x00\x00\x00\x00
Key for i=1:   \x00\x00\x00\x01
Key for i=255: \x00\x00\x00\xFF
```

Values are fixed markers (`"1"`) and are not part of the benchmark.

---

## Output

On success the script prints a summary block to stdout:

```
┌──────────────────────────────────────────────┐
│          Data Seeding Summary                 │
├──────────────────────────────────────────────┤
│  Keys seeded  : 1,000,000                    │
│  Time         : 15523 ms                     │
│  Throughput   : 64,421 keys/sec              │
└──────────────────────────────────────────────┘
```

---

## First Run Baseline

The following results were recorded on a local macOS machine (Apple M-series, Redis 8.8.0 via Homebrew) during the initial implementation run. These are not production benchmarks — they are provided as a sanity-check reference for new environments.

| N | Time | Throughput |
|---|---|---|
| 100 | 56 ms | 1,786 keys/sec |
| 10,000 | 279 ms | 35,842 keys/sec |
| 1,000,000 | 15,523 ms | 64,421 keys/sec |

If your numbers are significantly lower, check Redis connectivity, available memory, and whether another process is competing on the same machine.

---

## Error Codes

The script exits with code `1` for any of the following:

- Missing or invalid `--count` argument
- Cannot connect to Redis on `127.0.0.1:6379`
- Pipeline error during a batch
- `DBSIZE` does not match N after seeding

---

## Troubleshooting

**`Cannot connect to Redis`**
Verify Redis is running: `redis-cli ping`. If not, run `scripts/setup/provision-redis.sh` first.

**`DBSIZE mismatch`**
A pipeline batch likely dropped some commands. Check available memory and Redis logs. Re-run the script — FLUSHDB at the start ensures a clean retry.

**`Invalid value for --count`**
The value must be a plain non-negative integer with no commas or decimals. Use `--count 1000000` not `--count 1,000,000`.

---

## Related Files

| File | Purpose |
|---|---|
| `scripts/seed/seed-redis.ts` | The seeding script |
| `scripts/setup/provision-redis.sh` | Provisions Redis 8.8.0 — run this first |
| `specs/data-seeding-redis/data-seeding-redis.feature` | BDD specification this script implements |
