#!/usr/bin/env bash
# provision-redis.sh
# Installs and starts Redis 8.8.0 on any supported Unix/Linux host.
#
# Supported package managers: apt, dnf, yum, zypper, brew
# Usage: sudo ./provision-redis.sh [--force-kill-port]

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────────────
REDIS_VERSION="8.8.0"
REDIS_PORT=6379
FORCE_KILL_PORT=false

# Global memory snapshots (avoids stdout contamination when capturing values)
MEM_BEFORE="unknown"
MEM_AFTER="unknown"

# ── Argument parsing ───────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --force-kill-port) FORCE_KILL_PORT=true ;;
    *) echo "[ERROR] Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────────
log()  { echo "[INFO]  $*"; }
warn() { echo "[WARN]  $*"; }
fail() { echo "[ERROR] $*" >&2; exit 1; }

is_interactive() { [[ -t 0 ]]; }

# ── OS detection ───────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Linux*)  OS="linux"  ;;
  Darwin*) OS="macos"  ;;
  *)       fail "Unsupported OS: $(uname -s). This script supports Linux and macOS." ;;
esac

# ── Root check (Linux only; brew on macOS does not require root) ───────────────
if [[ "$OS" == "linux" ]] && [[ "$(id -u)" -ne 0 ]]; then
  fail "This script must be run as root on Linux. Try: sudo $0 $*"
fi

# ── Internet connectivity ──────────────────────────────────────────────────────
check_internet() {
  log "Checking internet connectivity..."
  local http_status
  http_status=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://packages.redis.io/gpg)
  [[ "$http_status" =~ ^[23] ]] \
    || fail "No internet access. Cannot reach packages.redis.io (HTTP ${http_status:-000})."
  log "Internet connectivity confirmed (HTTP ${http_status})."
}

# ── CPU check ─────────────────────────────────────────────────────────────────
check_cpu() {
  local cores
  if [[ "$OS" == "macos" ]]; then
    cores=$(sysctl -n hw.logicalcpu)
  else
    cores=$(nproc)
  fi
  log "Detected ${cores} CPU core(s)."
  [[ "$cores" -ge 1 ]] \
    || fail "Insufficient CPU: requires at least 1 core, found ${cores}."
}

# ── Memory snapshot ────────────────────────────────────────────────────────────
snapshot_memory() {
  local label="$1"
  local mb

  if [[ "$OS" == "macos" ]]; then
    local page_size free_pages
    page_size=$(vm_stat | awk '/page size/ {for(i=1;i<=NF;i++) if($i~/^[0-9]+$/) {print $i; exit}}')
    free_pages=$(vm_stat | awk '/Pages free/ {gsub(/[^0-9]/, "", $NF); print $NF}')
    mb=$(( free_pages * page_size / 1024 / 1024 ))
  elif command -v free > /dev/null 2>&1; then
    mb=$(free -m | awk '/^Mem:/ {print $4}')
  elif [[ -f /proc/meminfo ]]; then
    mb=$(awk '/MemAvailable/ {printf "%.0f\n", $2/1024}' /proc/meminfo)
  else
    mb="unknown"
  fi

  log "Free memory (${label}): ${mb} MB"

  if [[ "$label" == "before" ]]; then
    MEM_BEFORE="$mb"
  else
    MEM_AFTER="$mb"
  fi
}

# ── Idempotency check ──────────────────────────────────────────────────────────
check_idempotency() {
  if command -v redis-server > /dev/null 2>&1; then
    local installed_version
    installed_version=$(redis-server --version 2>/dev/null \
      | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
    if [[ "$installed_version" == "$REDIS_VERSION" ]] \
      && redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
      log "Redis ${REDIS_VERSION} is already installed and running on port ${REDIS_PORT}."
      log "Nothing to do. Exiting cleanly."
      exit 0
    fi
  fi
}

# ── Port conflict detection ────────────────────────────────────────────────────
get_pid_on_port() {
  local port="$1"
  local pid=""

  if command -v lsof > /dev/null 2>&1; then
    pid=$(lsof -ti :"$port" 2>/dev/null | head -1 || true)
  elif command -v ss > /dev/null 2>&1; then
    pid=$(ss -tlnp "sport = :${port}" 2>/dev/null \
      | awk 'NR>1 {match($6, /pid=([0-9]+)/, a); if(a[1]) print a[1]}' \
      | head -1 || true)
  elif command -v netstat > /dev/null 2>&1; then
    pid=$(netstat -tlnp 2>/dev/null \
      | awk -v port=":${port}" '$4 ~ port {split($7, a, "/"); print a[1]}' \
      | head -1 || true)
  fi

  echo "$pid"
}

check_port() {
  local pid
  pid=$(get_pid_on_port "$REDIS_PORT")
  [[ -z "$pid" ]] && return 0

  local proc
  proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
  warn "Port ${REDIS_PORT} is in use by '${proc}' (PID ${pid})."

  if $FORCE_KILL_PORT; then
    log "--force-kill-port flag set. Terminating PID ${pid}..."
    kill -9 "$pid"
    log "PID ${pid} terminated."
  elif is_interactive; then
    read -r -p "[PROMPT] Terminate '${proc}' (PID ${pid}) to free port ${REDIS_PORT}? [y/N] " confirm
    case "$confirm" in
      [yY])
        kill -9 "$pid"
        log "PID ${pid} terminated."
        ;;
      *)
        log "Aborting. No changes made."
        exit 0
        ;;
    esac
  else
    fail "Port ${REDIS_PORT} is in use by '${proc}' (PID ${pid}). Free it manually, re-run interactively, or pass --force-kill-port to allow automated termination."
  fi
}

# ── Package manager detection ──────────────────────────────────────────────────
detect_pm() {
  if   command -v apt-get > /dev/null 2>&1; then echo "apt"
  elif command -v dnf     > /dev/null 2>&1; then echo "dnf"
  elif command -v yum     > /dev/null 2>&1; then echo "yum"
  elif command -v zypper  > /dev/null 2>&1; then echo "zypper"
  elif command -v brew    > /dev/null 2>&1; then echo "brew"
  else
    fail "Unsupported package manager. Supported: apt, dnf, yum, zypper, brew."
  fi
}

# ── Install a single package, naming it on failure ────────────────────────────
install_dep() {
  local pm="$1" pkg="$2"
  log "Installing dependency: ${pkg}..."
  case "$pm" in
    apt)    apt-get install -y "$pkg"               || fail "Failed to install dependency: ${pkg}" ;;
    dnf)    dnf install -y "$pkg"                   || fail "Failed to install dependency: ${pkg}" ;;
    yum)    yum install -y "$pkg"                   || fail "Failed to install dependency: ${pkg}" ;;
    zypper) zypper --non-interactive install "$pkg" || fail "Failed to install dependency: ${pkg}" ;;
    brew)   brew install "$pkg"                     || fail "Failed to install dependency: ${pkg}" ;;
  esac
}

# ── Add official Redis repo and install 8.8.0 ─────────────────────────────────
add_repo_and_install() {
  local pm="$1"
  log "Adding official Redis repository (packages.redis.io) for: ${pm}..."

  case "$pm" in

    apt)
      for dep in curl gnupg lsb-release; do install_dep apt "$dep"; done

      curl -fsSL https://packages.redis.io/gpg \
        | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg \
        || fail "Failed to add Redis repository: GPG key download failed."

      echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
https://packages.redis.io/deb $(lsb_release -cs) main" \
        | tee /etc/apt/sources.list.d/redis.list > /dev/null \
        || fail "Failed to add Redis repository: could not write to sources.list.d."

      apt-get update -y \
        || fail "Failed to add Redis repository: apt-get update failed after adding Redis repo."

      apt-get install -y redis \
        || fail "Failed to install Redis via apt."
      ;;

    dnf|yum)
      install_dep "$pm" curl

      curl -fsSL https://packages.redis.io/rpm/rhel/redis.repo \
        -o /etc/yum.repos.d/redis.repo \
        || fail "Failed to add Redis repository: could not download redis.repo."

      "$pm" install -y redis \
        || fail "Failed to install Redis via ${pm}."
      ;;

    zypper)
      install_dep zypper curl

      curl -fsSL https://packages.redis.io/rpm/rhel/redis.repo \
        -o /etc/zypp/repos.d/redis.repo \
        || fail "Failed to add Redis repository: could not download redis.repo for zypper."

      zypper --non-interactive install redis \
        || fail "Failed to install Redis via zypper."
      ;;

    brew)
      log "macOS detected. Using Homebrew to install Redis."
      brew update || warn "brew update failed; continuing with existing formulae."
      brew install redis \
        || fail "Failed to install Redis via brew."
      ;;

  esac
}

# ── Start Redis service ────────────────────────────────────────────────────────
start_redis() {
  log "Starting Redis on port ${REDIS_PORT}..."

  if [[ "$OS" == "macos" ]]; then
    brew services start redis \
      || fail "Failed to start Redis via brew services."
  elif command -v systemctl > /dev/null 2>&1; then
    systemctl enable redis-server 2>/dev/null \
      || systemctl enable redis 2>/dev/null \
      || true
    systemctl start redis-server 2>/dev/null \
      || systemctl start redis 2>/dev/null \
      || fail "Failed to start Redis via systemctl."
  else
    redis-server --daemonize yes --port "$REDIS_PORT" \
      || fail "Failed to start Redis server in daemon mode."
  fi

  sleep 2
}

# ── Version verification ───────────────────────────────────────────────────────
verify_version() {
  local detected
  detected=$(redis-server --version 2>/dev/null \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  [[ "$detected" == "$REDIS_VERSION" ]] \
    || fail "Redis version mismatch. Expected: ${REDIS_VERSION}. Detected: ${detected:-unknown}."
  log "Redis version verified: ${detected}."
}

# ── Structured summary ─────────────────────────────────────────────────────────
print_summary() {
  local pid
  pid=$(redis-cli -p "$REDIS_PORT" INFO server 2>/dev/null \
    | grep "^process_id" | tr -d '[:space:]' | cut -d: -f2 || echo "unknown")

  echo ""
  echo "┌──────────────────────────────────────────────┐"
  echo "│         Redis Provisioning Summary            │"
  echo "├──────────────────────────────────────────────┤"
  printf "│  %-12s : %-29s│\n" "Version"     "$REDIS_VERSION"
  printf "│  %-12s : %-29s│\n" "Port"        "$REDIS_PORT"
  printf "│  %-12s : %-29s│\n" "PID"         "$pid"
  printf "│  %-12s : %-29s│\n" "Mem before"  "${MEM_BEFORE} MB free"
  printf "│  %-12s : %-29s│\n" "Mem after"   "${MEM_AFTER} MB free"
  echo "└──────────────────────────────────────────────┘"
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  log "=== Redis ${REDIS_VERSION} Provisioning Script ==="

  check_internet
  check_cpu
  check_idempotency

  snapshot_memory "before"

  check_port

  local pm
  pm=$(detect_pm)
  log "Detected package manager: ${pm}"

  add_repo_and_install "$pm"
  start_redis
  verify_version

  snapshot_memory "after"

  print_summary
  log "=== Provisioning complete ==="
}

main "$@"
