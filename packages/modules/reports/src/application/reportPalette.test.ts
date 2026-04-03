import assert from "node:assert/strict";
import test from "node:test";
import { BRAND, STATUS, SURFACE } from "@fieldpulse/pdf";
import {
  REPORT_AMBER,
  REPORT_GREEN,
  REPORT_POSITIVE,
  REPORT_RED,
  REPORT_SLATE,
  REPORT_TEAL,
  parseReportHexColor,
} from "./reportPalette";

test("reportPalette exposes shared report color tokens", () => {
  assert.deepEqual(REPORT_GREEN, BRAND.forest900);
  assert.deepEqual(REPORT_POSITIVE, BRAND.positive);
  assert.deepEqual(REPORT_RED, STATUS.critical);
  assert.deepEqual(REPORT_AMBER, STATUS.warning);
  assert.deepEqual(REPORT_TEAL, STATUS.info);
  assert.deepEqual(REPORT_SLATE, SURFACE.border);
});

test("reportPalette parses compact hex colors", () => {
  assert.deepEqual(parseReportHexColor("#16a34a"), [0.08627450980392157, 0.6392156862745098, 0.2901960784313726]);
  assert.deepEqual(parseReportHexColor("f59e0b"), [0.9607843137254902, 0.6196078431372549, 0.043137254901960784]);
  assert.equal(parseReportHexColor(""), undefined);
  assert.equal(parseReportHexColor("#12345"), undefined);
  assert.equal(parseReportHexColor("#zzzzzz"), undefined);
});
