import assert from "node:assert/strict";
import test from "node:test";

import { slugifyReportSegment } from "./reportSlug";

test("slugifyReportSegment normalizes compact artifact segments", () => {
  assert.equal(slugifyReportSegment("Biehn North 12A"), "biehn-north-12a");
  assert.equal(slugifyReportSegment("  Canola / Spring  "), "canola-spring");
  assert.equal(slugifyReportSegment("Field___Report"), "field-report");
});
