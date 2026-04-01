# Demo Readiness Live Snapshot

Date: 2026-04-01
Generated from live worker and Hope Creek readiness checks.

## Worker Ops

- Persistent worker is running under `launchd` via `/Users/ojieame/Library/LaunchAgents/com.fieldpulse.worker.loop.plist`
- Worker launch state: `running`
- Metrics listener: `http://0.0.0.0:9464`
- Queue health snapshot:
  - `queuedCount: 72`
  - `runningCount: 2`
  - `completedCount: 1188`
  - `failedCount: 11`
  - `cancelledCount: 5`
- Backlog is draining, but still too high for a healthy steady state.

## Hope Creek Readiness

Workspace: `8f2afceb-aefe-4e90-a24e-7ab07c4423fe`

- `fieldCount: 33`
- `vegetationReady: 15`
- `vegetationThin: 18`
- `vegetationEmpty: 0`
- `moistureReady: 16`
- `moistureThin: 17`
- `readyReady: 10`
- `readyThin: 5`
- `thinReady: 6`
- `thinThin: 12`
- `emptyAny: 0`

## Locked Demo Set

These fields are currently `ready` for both vegetation and moisture:

- `Main Farm`
- `Rath`
- `Rath West`
- `Robbie`
- `Roman East Q`
- `Roman Yard`
- `Sigurson`
- `Solomon`
- `Towes`
- `Towes Dugout`

Current demo risk fields in that 10-field shortlist:

- none

## Other Vegetation-Ready Fields

These are vegetation-ready but still moisture-thin:

- `Biehn`
- `Bricks`
- `Carl Yard`
- `Christoph Creek`
- `Church`

## Remaining Gaps

1. Worker operations still need hardening.
   Queue backlog remains high even though the persistent consumer is now in place.

2. Cold-path soil enrichment is still imperfect.
   Recent worker warnings still show `provider returned null` on some fields during soil enrichment.

3. Long-tail field richness is still incomplete.
   The demo set is now strong, but 18 Hope Creek fields remain vegetation-thin and 17 remain moisture-thin.

4. Hail backlog still exists.
   The queue still contains `hail.refresh-field` and `hail.schedule-workspace-refresh` work.

## Current Read

- Demo readiness: `GO` for the 10-field shortlist above
- Broad workspace richness: `not yet`
- Backend architecture: `strong`
- Service operations: `improving, but not fully hardened`
