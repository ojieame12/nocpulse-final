import assert from "node:assert/strict";
import test from "node:test";
import { describeWeatherSignalNarrative } from "./describeWeatherSignalNarrative";

test("describeWeatherSignalNarrative formats crop water demand copy", () => {
  assert.equal(
    describeWeatherSignalNarrative("crop-water-demand", 0.2),
    "Low crop water demand. Fungal disease risk elevated.",
  );
  assert.equal(
    describeWeatherSignalNarrative("crop-water-demand", 1.9),
    "High crop water demand. Rapid transpiration likely.",
  );
});

test("describeWeatherSignalNarrative formats water-balance copy", () => {
  assert.equal(
    describeWeatherSignalNarrative("water-balance-24h", -6),
    "Significant deficit. Irrigation needed soon.",
  );
  assert.equal(
    describeWeatherSignalNarrative("water-balance-72h", -4),
    "Moderate deficit over 72h.",
  );
});

test("describeWeatherSignalNarrative delegates frost copy to the shared frost narrative", () => {
  assert.equal(
    describeWeatherSignalNarrative("frost-risk", -6.4),
    "Hard frost. Significant crop damage risk.",
  );
});

test("describeWeatherSignalNarrative formats spray, leaf wetness, and gdd copy", () => {
  assert.equal(
    describeWeatherSignalNarrative("spray-windows-24h", 0),
    "No spray windows. Conditions unfavorable.",
  );
  assert.equal(
    describeWeatherSignalNarrative("leaf-wet-hours-24h", 8),
    "Moderate leaf wetness. Scout for disease.",
  );
  assert.equal(
    describeWeatherSignalNarrative("gdd-72h", 3),
    "Minimal heat accumulation. Growth stalled.",
  );
});

test("describeWeatherSignalNarrative handles missing values", () => {
  assert.equal(
    describeWeatherSignalNarrative("peak-vpd-24h", null),
    "Data unavailable",
  );
});
