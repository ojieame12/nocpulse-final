import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReportDate,
  formatReportDateStamp,
  formatReportDateTime,
  formatReportNumber,
  formatReportPercent,
} from "./reportFormat";

test("reportFormat renders compact numbers and percents", () => {
  assert.equal(formatReportNumber(12.345, 1), "12.3");
  assert.equal(formatReportNumber(null), "—");
  assert.equal(formatReportPercent(48.765, 0), "49%");
  assert.equal(formatReportPercent(undefined), "—");
});

test("reportFormat renders compact display dates and datetimes", () => {
  assert.equal(formatReportDate("2026-04-03T15:14:17.090Z"), "Apr 3, 2026");
  assert.match(formatReportDateTime("2026-04-03T15:14:17.090Z"), /Apr 3, 2026/);
  assert.equal(formatReportDate(null), "—");
  assert.equal(formatReportDateTime(undefined), "—");
});

test("reportFormat preserves compact ISO date stamps", () => {
  assert.equal(formatReportDateStamp("2026-04-03T15:14:17.090Z"), "2026-04-03");
  assert.equal(formatReportDateStamp(null), "—");
});
