import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TopBar } from "../TopBar";
import { FieldStrip } from "../FieldStrip";

test("TopBar disables Add Field when offline add is unavailable", () => {
  const markup = renderToStaticMarkup(
    <TopBar
      activeNav="Crops"
      onAddField={() => {}}
      showAddField
      addFieldDisabled
      addFieldDisabledReason="Adding fields requires an online connection."
    />,
  );

  assert.match(markup, /Add Field/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /Adding fields requires an online connection/);
});

test("FieldStrip keeps the add card visible but disabled when offline", () => {
  const markup = renderToStaticMarkup(
    <FieldStrip
      fields={[]}
      onAddField={() => {}}
      addFieldDisabled
      addFieldDisabledReason="Adding fields requires an online connection."
    />,
  );

  assert.match(markup, /Add/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /Adding fields requires an online connection/);
});
