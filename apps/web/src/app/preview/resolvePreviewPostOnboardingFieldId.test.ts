import test from "node:test";
import assert from "node:assert/strict";

import {
  isPlaceholderPreviewFieldId,
  resolvePreviewPostOnboardingFieldId,
} from "./resolvePreviewPostOnboardingFieldId";

test("isPlaceholderPreviewFieldId identifies the empty preview sentinel", () => {
  assert.equal(isPlaceholderPreviewFieldId("__empty__"), true);
  assert.equal(isPlaceholderPreviewFieldId(null), true);
  assert.equal(isPlaceholderPreviewFieldId("field-1"), false);
});

test("resolvePreviewPostOnboardingFieldId keeps the active field when preview is already on a real field", () => {
  assert.equal(
    resolvePreviewPostOnboardingFieldId({
      activeFieldId: "field-1",
      preferredFieldId: "field-2",
    }),
    "field-1",
  );
});

test("resolvePreviewPostOnboardingFieldId uses the chosen field when preview is still on the empty placeholder", () => {
  assert.equal(
    resolvePreviewPostOnboardingFieldId({
      activeFieldId: "__empty__",
      preferredFieldId: "field-2",
    }),
    "field-2",
  );
});

test("resolvePreviewPostOnboardingFieldId does not fall back to arbitrary field order when no safe choice exists", () => {
  assert.equal(
    resolvePreviewPostOnboardingFieldId({
      activeFieldId: "__empty__",
      preferredFieldId: null,
    }),
    null,
  );
});
