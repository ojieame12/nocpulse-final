import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AlertsPanel } from "../AlertsPanel";

test("AlertsPanel renders a real empty state instead of demo alerts by default", () => {
  const markup = renderToStaticMarkup(
    <AlertsPanel
      activeAlerts={[]}
      resolvedAlerts={[]}
      activeCount={0}
      criticalCount={0}
      weekCount={0}
    />,
  );

  assert.match(markup, /No active alerts/);
  assert.match(markup, /Field alerts will appear here when detections, weather risk, or agronomic thresholds trigger\./);
  assert.doesNotMatch(markup, /Root Zone Moisture Below Threshold/);
  assert.doesNotMatch(markup, /Frost Risk/);
});

test("AlertsPanel can still opt into demo alerts explicitly", () => {
  const markup = renderToStaticMarkup(
    <AlertsPanel
      activeAlerts={[]}
      resolvedAlerts={[]}
      activeCount={0}
      criticalCount={0}
      weekCount={0}
      demoFallback
    />,
  );

  assert.match(markup, /Root Zone Moisture Below Threshold/);
  assert.match(markup, /4 active · 1 critical · 6 this week/);
});

test("AlertsPanel renders review and dismiss actions for live active alerts", () => {
  const markup = renderToStaticMarkup(
    <AlertsPanel
      activeAlerts={[
        {
          id: "alert-1",
          title: "Field changed materially this week",
          severity: "warning",
          subtitle: "Moisture and canopy shifted more than the workspace baseline.",
          time: "2h ago",
          trackedZoneIds: ["z-1"],
        },
      ]}
      resolvedAlerts={[]}
      activeCount={1}
      criticalCount={0}
      weekCount={1}
      actionsEnabled
    />,
  );

  assert.match(markup, /Mark reviewed/);
  assert.match(markup, /Dismiss/);
});

test("AlertsPanel hides live actions when alert mutations are disabled", () => {
  const markup = renderToStaticMarkup(
    <AlertsPanel
      activeAlerts={[
        {
          id: "alert-1",
          title: "Field changed materially this week",
          severity: "warning",
          subtitle: "Moisture and canopy shifted more than the workspace baseline.",
          time: "2h ago",
          trackedZoneIds: ["z-1"],
        },
      ]}
      resolvedAlerts={[]}
      activeCount={1}
      criticalCount={0}
      weekCount={1}
      actionsEnabled={false}
    />,
  );

  assert.doesNotMatch(markup, /Mark reviewed/);
  assert.doesNotMatch(markup, /Dismiss/);
});
