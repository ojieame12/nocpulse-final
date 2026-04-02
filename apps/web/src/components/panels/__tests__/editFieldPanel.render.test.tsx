import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EditFieldPanel } from "../EditFieldPanel";

function createBaseProps() {
  return {
    fieldId: "field-1",
    fieldName: "North Quarter",
    areaHaLabel: "259.0 ha",
    lld: "NW-25-010-17-W4",
    crop: "Canola",
    seedingDate: "2026-04-28",
    cropStage: "Vegetative stage",
    growthStageKey: "vegetative",
    growthStageSource: "derived",
    growthStageLabel: "Vegetative stage",
    accumulatedGdd: "245",
    onClose: () => {},
    onUpdateCrop: async () => true,
  } as const;
}

test("EditFieldPanel renders the derived-stage auto option and manual-stage choices", () => {
  const markup = renderToStaticMarkup(<EditFieldPanel {...createBaseProps()} />);

  assert.match(markup, /Growth stage/);
  assert.match(markup, /Seeding date/);
  assert.match(markup, /value="2026-04-28"/);
  assert.match(markup, /Auto \(use current derived stage\)/);
  assert.match(markup, /Pre Seed/);
  assert.match(markup, /Vegetative/);
  assert.match(markup, /Flowering/);
  assert.match(markup, /Ripening/);
  assert.match(markup, /Stage basis/);
  assert.match(markup, /Vegetative stage/);
});

test("EditFieldPanel renders the clear-manual option when a manual override is active", () => {
  const markup = renderToStaticMarkup(
    <EditFieldPanel
      {...createBaseProps()}
      seedingDate={null}
      growthStageSource="manual"
      growthStageLabel="Flowering stage"
      growthStageKey="flowering"
    />,
  );

  assert.match(markup, /Auto \(clear manual override\)/);
  assert.match(markup, /Flowering stage · manual/);
});

test("EditFieldPanel renders archive and permanent delete guidance in the danger zone", () => {
  const markup = renderToStaticMarkup(
    <EditFieldPanel
      {...createBaseProps()}
      onArchive={() => {}}
      onDeletePermanently={() => {}}
    />,
  );

  assert.match(markup, /Danger Zone/);
  assert.match(markup, /Archive removes/);
  assert.match(markup, /Archive this field/);
  assert.match(markup, /Delete permanently/);
  assert.match(markup, /detaches import batch history/);
});
