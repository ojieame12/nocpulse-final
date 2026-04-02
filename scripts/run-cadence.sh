#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs/cadence"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"

mkdir -p "${LOG_DIR}/market" "${LOG_DIR}/probe" "${LOG_DIR}/hail"

usage() {
  cat <<'EOF'
Usage:
  scripts/run-cadence.sh market
  scripts/run-cadence.sh probe
  scripts/run-cadence.sh hail

Environment overrides:
  FIELDPULSE_WORKSPACE_ID   Workspace for hail runs.
  FIELDPULSE_HAIL_LIMIT     Default: 50
  FIELDPULSE_DRAIN_LIMIT    Default: 100
  FIELDPULSE_STALE_HOURS    Default: 24
  FIELDPULSE_PROBE_LIMIT    Default: 50
  FIELDPULSE_PROBE_SINCE    Default: 6
EOF
}

run_job() {
  local name="$1"
  shift

  local logfile="${LOG_DIR}/${name}/${TIMESTAMP}.log"
  local status=0

  set +e
  {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] starting ${name}"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] cwd=${ROOT_DIR}"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] command=$*"
    echo
    cd "${ROOT_DIR}"
    "$@"
    echo
  } >>"${logfile}" 2>&1
  status=$?
  set -e

  if [[ ${status} -eq 0 ]]; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] completed ${name}" >>"${logfile}"
  else
    echo >>"${logfile}"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] failed ${name} exit=${status}" >>"${logfile}"
  fi

  ln -sfn "${logfile}" "${LOG_DIR}/${name}/latest.log"
  echo "${logfile}"
  return "${status}"
}

JOB="${1:-}"

case "${JOB}" in
  market)
    run_job \
      market \
      corepack pnpm --filter @fieldpulse/worker market:cadence -- --commodity CANOLA
    ;;
  probe)
    PROBE_LIMIT="${FIELDPULSE_PROBE_LIMIT:-50}"
    PROBE_SINCE="${FIELDPULSE_PROBE_SINCE:-6}"
    run_job \
      probe \
      /bin/bash -o pipefail -c \
      "corepack pnpm --filter @fieldpulse/worker imagery:probe-schedule -- --limit ${PROBE_LIMIT} && \
       corepack pnpm --filter @fieldpulse/worker drain -- --key imagery.schedule-workspace-provider-probes,imagery.record-provider-probe --limit 100 && \
       corepack pnpm --filter @fieldpulse/worker imagery:probe-report -- --since-hours ${PROBE_SINCE}"
    ;;
  hail)
    WORKSPACE_ID="${FIELDPULSE_WORKSPACE_ID:-a625a72d-a2de-43ee-8bb4-aad93466f750}"
    HAIL_LIMIT="${FIELDPULSE_HAIL_LIMIT:-50}"
    DRAIN_LIMIT="${FIELDPULSE_DRAIN_LIMIT:-100}"
    STALE_HOURS="${FIELDPULSE_STALE_HOURS:-24}"
    run_job \
      hail \
      corepack pnpm --filter @fieldpulse/worker hail:cadence -- \
      --workspace-id "${WORKSPACE_ID}" \
      --limit "${HAIL_LIMIT}" \
      --drain-limit "${DRAIN_LIMIT}" \
      --stale-after-hours "${STALE_HOURS}"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown cadence job: ${JOB}" >&2
    usage >&2
    exit 1
    ;;
esac
