---
name: provision-redis-setup
description: Reasoning and execution guide for agents working with the Redis 8.8.0 host provisioning script. Use when asked to run, troubleshoot, extend, or integrate the provision-redis.sh script into CI/CD or Terraform workflows.
agent: agent
argument-hint: "Describe what you need: run the script, troubleshoot a failure, extend it for a new platform, or integrate it into a pipeline."
---

# Provision Redis Setup — Agent Instructions

## Purpose

This skill governs agent behaviour when working with `scripts/setup/provision-redis.sh`.

The script installs Redis 8.8.0 directly on any supported Unix/Linux host or macOS machine using the official Redis repository at `packages.redis.io`. It is the first step in the KV benchmark provisioning workflow. Container-based provisioning is deferred to a future iteration.

---

## Script Location and Permissions

```
scripts/setup/provision-redis.sh
```

The script **must** have the executable bit set before it can be run:

```bash
chmod +x scripts/setup/provision-redis.sh
```

On Linux it **must** be run as root. On macOS root is not required (Homebrew).

---

## Supported Environments

| Package Manager | Platform |
|---|---|
| `apt` | Debian, Ubuntu, and derivatives |
| `dnf` | Fedora, RHEL 8+, AlmaLinux, Rocky |
| `yum` | CentOS, RHEL 7 |
| `zypper` | openSUSE, SLES |
| `brew` | macOS |

Any other package manager causes the script to exit with a failure code and a message listing the supported options.

---

## Invocation

```bash
# Interactive (Linux)
sudo ./scripts/setup/provision-redis.sh

# Interactive (macOS)
./scripts/setup/provision-redis.sh

# Non-interactive / CI with automatic port conflict resolution
sudo ./scripts/setup/provision-redis.sh --force-kill-port
```

---

## Script Contract — Scenario Mapping

| Feature scenario | Script behaviour |
|---|---|
| Provision on clean host | `detect_pm` → add official Redis repo → `install_dep` → `start_redis` → `verify_version` |
| Idempotency | `check_idempotency` exits cleanly if Redis 8.8.0 already running on port 6379 |
| Dependency failure | `install_dep` exits with the failing package name |
| Repo registration failure | Every `curl` and repo-write step has its own `fail` message |
| Port conflict — interactive | `check_port` prompts `y/N` when stdin is a TTY |
| Port conflict — non-interactive | `check_port` exits with message; instructs operator to pass `--force-kill-port` |
| Unsupported package manager | `detect_pm` lists supported PMs and exits |
| Insufficient CPU | `check_cpu` exits with message if fewer than 1 core available |
| Version mismatch | `verify_version` shows expected vs detected version |
| Memory logging | `snapshot_memory` called before and after provisioning |
| Structured summary | `print_summary` emits version, port, PID, and memory to stdout on success |

---

## Port Conflict Handling

- **Interactive TTY** — prompts the user before killing the conflicting process.
- **Non-interactive (CI)** — fails with the PID and process name; does not kill automatically.
- **`--force-kill-port` flag** — kills the conflicting process without prompting; safe to pass in CI pipelines that explicitly allow it.

The port conflict check uses `lsof` → `ss` → `netstat` in order to maximise compatibility.

---

## Structured Summary Output

On success the script emits to stdout:

```
┌──────────────────────────────────────────────┐
│         Redis Provisioning Summary            │
├──────────────────────────────────────────────┤
│  Version      : 8.8.0                        │
│  Port         : 6379                         │
│  PID          : <pid>                        │
│  Mem before   : <n> MB free                  │
│  Mem after    : <n> MB free                  │
└──────────────────────────────────────────────┘
```

CI pipelines and Terraform provisioners should capture this block for logging and assertions.

---

## Exit Codes

The script uses `set -euo pipefail`. It exits `1` with a `[ERROR]` prefixed message for:

- Unsupported OS
- Not running as root on Linux
- No internet access
- Fewer than 1 CPU core
- Unsupported package manager
- Failed dependency installation (package named)
- Redis repository registration failure
- Port conflict in non-interactive mode (without `--force-kill-port`)
- Redis version mismatch post-install

---

## Agent Guidance — Troubleshooting

When a user reports a provisioning failure, the agent should:

1. Ask for the exact `[ERROR]` line from stdout.
2. Map it to the table above to identify the responsible script section.
3. Check whether the host meets the prerequisites (root, OS, internet, supported PM).
4. If the error is a version mismatch, confirm whether a conflicting Redis package is already installed and suggest uninstalling it first.
5. If the error is a repo registration failure, confirm internet access to `packages.redis.io`.

---

## Agent Guidance — Extending the Script

When asked to add support for a new platform or package manager:

1. Add the new PM to `detect_pm`.
2. Add a matching `case` branch in `add_repo_and_install` that adds the official Redis repo and installs Redis 8.8.0.
3. Ensure `install_dep` has a matching `case` branch for the new PM.
4. Update `docs/setup/provision-redis.md` prerequisites and the supported environments table in this skill.
5. Update the feature file `specs/provision-redis-container/provision-redis-container.feature` to reflect the new platform.

---

## Agent Guidance — CI/CD Integration

When asked to integrate this script into a CI pipeline:

- Pass `--force-kill-port` only if the pipeline has explicit ownership of port 6379.
- Capture the structured summary block from stdout for logging.
- Assert on the `Version` line to confirm 8.8.0 before proceeding to benchmark steps.
- If using GitHub Actions, run the step with `sudo` on Linux runners; omit `sudo` on macOS runners.

---

## Agent Guidance — Terraform Integration

When asked to integrate with Terraform:

- Wrap the script in a `null_resource` provisioner using a `local-exec` or `remote-exec` block.
- Pass `--force-kill-port` in non-interactive Terraform apply runs when appropriate.
- Use the structured summary output as a basis for Terraform outputs or data sources that downstream resources depend on.
- Version-pin the Redis version string (`8.8.0`) as a Terraform variable so it stays consistent with the script constant.

---

## Related Files

| File | Purpose |
|---|---|
| `scripts/setup/provision-redis.sh` | The provisioning script |
| `docs/setup/provision-redis.md` | Human-facing usage and troubleshooting guide |
| `specs/provision-redis-container/provision-redis-container.feature` | BDD specification this script implements |
