import assert from "node:assert/strict";
import test from "node:test";
import { getPreviewFieldRoute, getPreviewHomeRoute } from "./previewRoutes";

test("getPreviewHomeRoute targets the canonical preview entrypoint", () => {
  assert.equal(getPreviewHomeRoute(), "/preview");
});

test("getPreviewFieldRoute preserves field selection through a preview redirect", () => {
  assert.equal(
    getPreviewFieldRoute("e5df1094-7a5c-42ec-a131-0c25af4be08c"),
    "/preview?fieldId=e5df1094-7a5c-42ec-a131-0c25af4be08c",
  );
});

test("getPreviewFieldRoute safely encodes route field ids", () => {
  assert.equal(
    getPreviewFieldRoute("field with spaces/&symbols"),
    "/preview?fieldId=field%20with%20spaces%2F%26symbols",
  );
});
