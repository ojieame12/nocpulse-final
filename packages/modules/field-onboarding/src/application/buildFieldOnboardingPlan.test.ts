import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInitialFieldOnboardingPlan,
  buildRefreshFieldOnboardingPlan,
} from "../index";

test("buildInitialFieldOnboardingPlan queues the ordered bootstrap job", () => {
  const plan = buildInitialFieldOnboardingPlan({
    workspaceId: "workspace-1",
    fieldId: "field-1",
    requestedAt: "2026-03-30T08:00:00.000Z",
    providers: ["sentinel-2", "planet"],
    dryRun: false,
  });

  assert.equal(plan.jobs.length, 1);
  assert.deepEqual(plan.jobs[0], {
    key: "field.bootstrap-initial",
    payload: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      requestedAt: "2026-03-30T08:00:00.000Z",
      providers: ["sentinel-2", "planet"],
      dryRun: false,
    },
  });
});

test("buildRefreshFieldOnboardingPlan queues the lighter intake refresh job", () => {
  const plan = buildRefreshFieldOnboardingPlan({
    workspaceId: "workspace-1",
    fieldId: "field-2",
    requestedAt: "2026-03-30T09:00:00.000Z",
    dryRun: true,
  });

  assert.equal(plan.jobs.length, 1);
  assert.deepEqual(plan.jobs[0], {
    key: "field.refresh-intake",
    payload: {
      workspaceId: "workspace-1",
      fieldId: "field-2",
      requestedAt: "2026-03-30T09:00:00.000Z",
      providers: undefined,
      dryRun: true,
    },
  });
});
