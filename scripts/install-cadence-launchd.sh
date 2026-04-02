#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${ROOT_DIR}/scripts/launchd"
TARGET_DIR="${HOME}/Library/LaunchAgents"

mkdir -p \
  "${TARGET_DIR}" \
  "${ROOT_DIR}/logs/cadence/market" \
  "${ROOT_DIR}/logs/cadence/probe" \
  "${ROOT_DIR}/logs/cadence/hail"

for name in market probe hail; do
  plist="com.fieldpulse.cadence.${name}.plist"
  cp "${SOURCE_DIR}/${plist}" "${TARGET_DIR}/${plist}"
  launchctl bootout "gui/$(id -u)/com.fieldpulse.cadence.${name}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "${TARGET_DIR}/${plist}"
done

launchctl print "gui/$(id -u)/com.fieldpulse.cadence.market" >/dev/null
launchctl print "gui/$(id -u)/com.fieldpulse.cadence.probe" >/dev/null
launchctl print "gui/$(id -u)/com.fieldpulse.cadence.hail" >/dev/null

echo "Installed launchd agents:"
echo "  com.fieldpulse.cadence.market"
echo "  com.fieldpulse.cadence.probe"
echo "  com.fieldpulse.cadence.hail"
