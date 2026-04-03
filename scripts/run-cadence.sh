#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs/cadence"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"

mkdir -p "${LOG_DIR}/market" "${LOG_DIR}/probe" "${LOG_DIR}/hail" "${LOG_DIR}/action-brief"

usage() {
  cat <<'EOF'
Usage:
  scripts/run-cadence.sh market
  scripts/run-cadence.sh probe
  scripts/run-cadence.sh hail
  scripts/run-cadence.sh action-brief

Environment overrides:
  FIELDPULSE_WORKSPACE_ID   Workspace for hail runs.
  FIELDPULSE_HAIL_LIMIT     Default: 50
  FIELDPULSE_DRAIN_LIMIT    Default: 100
  FIELDPULSE_STALE_HOURS    Default: 24
  FIELDPULSE_PROBE_LIMIT    Default: 50
  FIELDPULSE_PROBE_SINCE    Default: 6
  FIELDPULSE_MARKET_CROP_SYMBOLS       Default: CANOLA,WHEAT,CORN,RYE,SOYBEAN
  FIELDPULSE_MARKET_STALE_HOURS        Default: 24
  FIELDPULSE_ACTION_BRIEF_WORKSPACE_ID  Optional workspace for action-brief runs.
  FIELDPULSE_ACTION_BRIEF_LIMIT         Optional per-workspace field limit.
  FIELDPULSE_ACTION_BRIEF_DRAIN_LIMIT   Default: 100
  FIELDPULSE_ACTION_BRIEF_REPORT_LIMIT  Default: 50
  FIELDPULSE_ACTION_BRIEF_FORECAST_HOURS Optional weather forecast horizon override.
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
    MARKET_CROP_SYMBOLS="${FIELDPULSE_MARKET_CROP_SYMBOLS:-CANOLA,WHEAT,CORN,RYE,SOYBEAN}"
    MARKET_STALE_HOURS="${FIELDPULSE_MARKET_STALE_HOURS:-24}"
    run_job \
      market \
      /bin/bash -o pipefail -c \
      'corepack pnpm --filter @fieldpulse/worker market:cadence -- --crop-symbols "$1" && \
       corepack pnpm --filter @fieldpulse/worker market:report -- --crop-symbols "$1" --stale-after-hours "$2"' \
      _ \
      "${MARKET_CROP_SYMBOLS}" \
      "${MARKET_STALE_HOURS}"
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
  action-brief)
    ACTION_BRIEF_WORKSPACE_ID="${FIELDPULSE_ACTION_BRIEF_WORKSPACE_ID:-}"
    ACTION_BRIEF_LIMIT="${FIELDPULSE_ACTION_BRIEF_LIMIT:-}"
    ACTION_BRIEF_DRAIN_LIMIT="${FIELDPULSE_ACTION_BRIEF_DRAIN_LIMIT:-100}"
    ACTION_BRIEF_REPORT_LIMIT="${FIELDPULSE_ACTION_BRIEF_REPORT_LIMIT:-50}"
    ACTION_BRIEF_FORECAST_HOURS="${FIELDPULSE_ACTION_BRIEF_FORECAST_HOURS:-}"

    ACTION_BRIEF_ARGS=(--drain-limit "${ACTION_BRIEF_DRAIN_LIMIT}" --report-limit "${ACTION_BRIEF_REPORT_LIMIT}")

    if [[ -n "${ACTION_BRIEF_WORKSPACE_ID}" ]]; then
      ACTION_BRIEF_ARGS+=(--workspace-id "${ACTION_BRIEF_WORKSPACE_ID}")
    fi

    if [[ -n "${ACTION_BRIEF_LIMIT}" ]]; then
      ACTION_BRIEF_ARGS+=(--limit "${ACTION_BRIEF_LIMIT}")
    fi

    if [[ -n "${ACTION_BRIEF_FORECAST_HOURS}" ]]; then
      ACTION_BRIEF_ARGS+=(--forecast-hours "${ACTION_BRIEF_FORECAST_HOURS}")
    fi

    run_job \
      action-brief \
      corepack pnpm --filter @fieldpulse/worker action-brief:cadence -- \
      "${ACTION_BRIEF_ARGS[@]}"
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
