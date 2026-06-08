# Redis 8.8.0 Host Provisioning

## Overview

`scripts/setup/provision-redis.sh` installs and starts Redis 8.8.0 directly on the host.  
It is designed to run on any supported Unix/Linux environment and on macOS.

---

## Prerequisites

| Requirement | Details |
|---|---|
| OS | Any Unix/Linux distribution or macOS |
| Privileges | Root (`sudo`) required on Linux; not required on macOS |
| Internet access | Required to reach `packages.redis.io` |
| CPU | At least 1 available core |
| Supported package manager | `apt`, `dnf`, `yum`, `zypper`, or `brew` |

---

## Making the Script Executable

Before running the script for the first time you must set the executable bit:

```bash
chmod +x scripts/setup/provision-redis.sh
```

---

## Usage

```bash
# Standard interactive run (Linux)
sudo ./scripts/setup/provision-redis.sh

# Standard interactive run (macOS)
./scripts/setup/provision-redis.sh

# Allow automated port conflict resolution (CI / non-interactive)
sudo ./scripts/setup/provision-redis.sh --force-kill-port
```

---

## Flags

| Flag | Purpose |
|---|---|
| `--force-kill-port` | Automatically terminate the process occupying port 6379 without prompting. Use in CI pipelines or non-interactive environments. |

---

## What the Script Does

| Step | Description |
|---|---|
| Internet check | Probes `packages.redis.io` before attempting any installs |
| CPU check | Verifies at least 1 core is available |
| Idempotency check | If Redis 8.8.0 is already installed and running on port 6379, exits cleanly with a message |
| Memory snapshot (before) | Logs available free memory before provisioning starts |
| Port conflict check | Detects processes on port 6379; prompts interactively or fails safely in CI (see flags) |
| Package manager detection | Detects `apt`, `dnf`, `yum`, `zypper`, or `brew`; exits with error if none found |
| Redis repo registration | Adds the official Redis repo from `packages.redis.io` for the detected package manager |
| Dependency installation | Installs required tools (`curl`, `gnupg`, etc.) naming any that fail |
| Redis 8.8.0 installation | Installs Redis from the official repository |
| Redis startup | Starts Redis via `systemctl`, `brew services`, or daemon mode as appropriate |
| Version verification | Confirms the running instance reports version `8.8.0`; exits with an error if not |
| Memory snapshot (after) | Logs available free memory after provisioning completes |
| Structured summary | Emits a summary block to stdout with version, port, PID, and memory before/after |

---

## Port Conflict Behaviour

| Context | Behaviour |
|---|---|
| Interactive terminal | Displays the conflicting process and prompts `y/N` before killing it |
| Non-interactive / CI | Exits with an error identifying the process and instructing the operator to free the port manually or use `--force-kill-port` |
| `--force-kill-port` passed | Terminates the conflicting process automatically without prompting |

---

## Structured Summary Output

On success the script prints a summary block to stdout:

```
┌──────────────────────────────────────────────┐
│         Redis Provisioning Summary            │
├──────────────────────────────────────────────┤
│  Version      : 8.8.0                        │
│  Port         : 6379                         │
│  PID          : 12345                        │
│  Mem before   : 3012 MB free                 │
│  Mem after    : 2901 MB free                 │
└──────────────────────────────────────────────┘
```

This output is designed to be consumable by CI pipelines and Terraform provisioners.

---

## Error Codes

The script exits with code `1` and a descriptive message for any of the following:

- Unsupported OS
- Not running as root (Linux)
- No internet access
- Fewer than 1 CPU core available
- Unsupported package manager (lists supported options)
- Failed dependency installation (names the failing package)
- Redis repository registration failure
- Port conflict in non-interactive mode (without `--force-kill-port`)
- Redis version mismatch after installation

---

## Troubleshooting

**Redis is already installed but wrong version**  
Uninstall the existing Redis package via your package manager, then re-run the script.

**Port 6379 is in use in CI**  
Add `--force-kill-port` to the script invocation, or stop the conflicting service in your pipeline before running this script.

**Package manager not detected**  
The script supports `apt`, `dnf`, `yum`, `zypper`, and `brew`. Other package managers are not currently supported.

**Redis repo cannot be added**  
Verify internet access to `packages.redis.io` and that your package manager supports external repository sources.

---

## Future

This script is designed to be the first step in a broader provisioning workflow.  
Later iterations will introduce Terraform-managed environments and CI/CD pipeline integration.  
The `--force-kill-port` flag and the structured stdout summary are both designed with that transition in mind.
