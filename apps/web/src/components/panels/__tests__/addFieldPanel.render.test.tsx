import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AddFieldPanel, JobStatusCard, SpreadsheetIssuesCard } from "../AddFieldPanel";

test("AddFieldPanel exposes the live add-field methods without manual entry", () => {
  const markup = renderToStaticMarkup(
    <AddFieldPanel workspaceId="workspace-1" />,
  );

  assert.match(markup, /LLD Lookup/);
  assert.match(markup, /Upload CSV/);
  assert.match(markup, /Upload KML/);
  assert.doesNotMatch(markup, /Manual Entry/);
  assert.match(markup, /Lookup LLD/);
  assert.doesNotMatch(markup, /Notes/);
});

test("SpreadsheetIssuesCard renders row-level CSV issues", () => {
  const markup = renderToStaticMarkup(
    <SpreadsheetIssuesCard
      issues={[
        { rowNumber: 4, message: "Missing LLD value." },
        { rowNumber: 7, message: "Area must be a valid number." },
      ]}
    />,
  );

  assert.match(markup, /IMPORT ISSUES/);
  assert.match(markup, /Row 4/);
  assert.match(markup, /Missing LLD value\./);
  assert.match(markup, /Row 7/);
  assert.match(markup, /Area must be a valid number\./);
});

test("JobStatusCard exposes retry hydration for failed onboarding jobs", () => {
  const markup = renderToStaticMarkup(
    <JobStatusCard
      trackedJobs={[
        {
          dispatchId: "dispatch-1",
          fieldId: "field-1",
          fieldLabel: "North Quarter",
          action: "created",
          fieldAction: "created",
          cropType: "Canola",
          legalLandDescriptions: ["NW-25-042-04-W4"],
        },
      ]}
      jobStatuses={
        new Map([
          [
            "dispatch-1",
            {
              id: "dispatch-1",
              key: "field.bootstrap-initial",
              status: "failed",
              activePhaseLabel: "Sync imagery",
              progressPct: 65,
              progressMessage: null,
              updatedAt: "2026-04-02T10:00:00.000Z",
              completedAt: null,
              failedAt: "2026-04-02T10:00:00.000Z",
              cancelledAt: null,
              lastError: "Imagery provider timed out.",
              fieldId: "field-1",
            },
          ],
        ])
      }
      onRetryHydration={() => {}}
    />,
  );

  assert.match(markup, /Failed 1/);
  assert.match(markup, /Retry hydration/);
  assert.match(markup, /Imagery provider timed out\./);
});
