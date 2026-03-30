import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeNextPath } from "./sanitizeNextPath";

test("sanitizeNextPath keeps internal paths", () => {
  assert.equal(
    sanitizeNextPath("/fields/123?tab=summary"),
    "/fields/123?tab=summary",
  );
});

test("sanitizeNextPath rejects protocol-relative redirects", () => {
  assert.equal(sanitizeNextPath("//evil.example"), "/");
});

test("sanitizeNextPath falls back for external URLs", () => {
  assert.equal(sanitizeNextPath("https://evil.example"), "/");
});

test("sanitizeNextPath falls back for empty or invalid values", () => {
  assert.equal(sanitizeNextPath(""), "/");
  assert.equal(sanitizeNextPath(undefined), "/");
  assert.equal(sanitizeNextPath("javascript:alert(1)"), "/");
});
