import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HydrationOverlay } from "./HydrationOverlay";

function createStatus(
  status: "queued" | "running" | "completed" | "failed" | "cancelled",
) {
  return {
    status,
    progressPct: status === "completed" ? 100 : 35,
    phaseLabel: status === "queued" ? "Queued" : "Collecting imagery",
  } as const;
}

test("HydrationOverlay does not render for failed onboarding when inactive", () => {
  const markup = renderToStaticMarkup(
    <HydrationOverlay
      active={false}
      fieldName="Biehn"
      onboardingStatus={createStatus("failed")}
      progressMessage="Imagery failed"
      prebuiltStages={null}
    />,
  );

  assert.equal(markup, "");
});

test("HydrationOverlay does not render for cancelled onboarding when inactive", () => {
  const markup = renderToStaticMarkup(
    <HydrationOverlay
      active={false}
      fieldName="Biehn"
      onboardingStatus={createStatus("cancelled")}
      progressMessage="Cancelled"
      prebuiltStages={null}
    />,
  );

  assert.equal(markup, "");
});

test("HydrationOverlay renders the tracker while onboarding is active", () => {
  const markup = renderToStaticMarkup(
    <HydrationOverlay
      active
      fieldName="Biehn"
      onboardingStatus={createStatus("running")}
      progressMessage="Collecting weather"
      prebuiltStages={null}
    />,
  );

  assert.match(markup, /Preparing Biehn/);
  assert.match(markup, /Weather observations/);
});
