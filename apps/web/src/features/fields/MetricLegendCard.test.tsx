import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ThemeContext } from "../../components/layout/WorkspaceShell";
import { MetricLegendCard } from "./MetricLegendCard";

function renderCard(props: Partial<React.ComponentProps<typeof MetricLegendCard>> = {}) {
  return renderToStaticMarkup(
    <ThemeContext.Provider value="dark">
      <MetricLegendCard
        metricKey="root-zone-moisture-pct"
        metricAveragePct={54}
        sourceLabel="sentinel-hub-stats-v1:sentinel-1"
        allMetrics={["root-zone-moisture-pct", "ndvi"]}
        availableMetrics={["root-zone-moisture-pct", "ndvi"]}
        availableMetricDetails={{
          "root-zone-moisture-pct": {
            sourceLabel: "sentinel-hub-stats-v1:sentinel-1",
            confidence: "high",
          },
          ndvi: {
            sourceLabel: "sentinel-hub-stats-v1:sentinel-2",
            confidence: "high",
          },
        }}
        {...props}
      />
    </ThemeContext.Provider>,
  );
}

test("MetricLegendCard marks the requested metric active even when the rendered surface differs", () => {
  const markup = renderCard({ selectedMetricKey: "ndvi" });

  assert.match(markup, /<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?Moisture/);
  assert.match(markup, /<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?NDVI/);
});

test("MetricLegendCard defaults the active pill to the rendered metric when no selection is provided", () => {
  const markup = renderCard();

  assert.match(markup, /<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Moisture/);
});
