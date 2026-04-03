import assert from "node:assert/strict";
import test from "node:test";
import {
  describeAgronomicTruthBasis,
  formatAgronomicSourceBasisLabel,
  resolveAgronomicSourceBasis,
} from "./resolveAgronomicSourceBasis";

test("resolveAgronomicSourceBasis normalizes source-backed, modeled, and context-only labels", () => {
  assert.deepEqual(resolveAgronomicSourceBasis("sentinel-1:sar"), {
    basis: "source-backed",
    badgeShort: "SAR",
    badgeLong: "Source-backed (SAR)",
    validityLabel: "Source-backed surface",
  });

  assert.deepEqual(resolveAgronomicSourceBasis("preseason-optical-context"), {
    basis: "context-only",
    badgeShort: "CTX",
    badgeLong: "Context-only",
    validityLabel: "Context-only",
  });

  assert.deepEqual(resolveAgronomicSourceBasis("synthetic:fallback"), {
    basis: "modeled",
    badgeShort: "EST",
    badgeLong: "Modeled",
    validityLabel: "Modeled estimate",
  });
});

test("formatAgronomicSourceBasisLabel provides stable user-facing vocabulary", () => {
  assert.equal(formatAgronomicSourceBasisLabel("source-backed"), "Source-backed");
  assert.equal(formatAgronomicSourceBasisLabel("modeled"), "Modeled");
  assert.equal(formatAgronomicSourceBasisLabel("pending"), "Pending");
  assert.equal(formatAgronomicSourceBasisLabel("context-only"), "Context-only");
});

test("describeAgronomicTruthBasis strips legacy prefixes and preserves useful detail", () => {
  assert.equal(
    describeAgronomicTruthBasis({
      derivationMode: "modeled",
      sourceTagExtended: "Model estimate · weather + soil",
    }),
    "Modeled · weather + soil",
  );

  assert.equal(
    describeAgronomicTruthBasis({
      derivationMode: "source-backed",
      sourceTagExtended: "Satellite-derived · medium confidence",
    }),
    "Source-backed · medium confidence",
  );

  assert.equal(
    describeAgronomicTruthBasis({
      derivationMode: "source-backed",
      confidenceSub: "high confidence",
    }),
    "Source-backed · high confidence",
  );
});
