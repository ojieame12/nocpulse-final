import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AddFieldPanel, SpreadsheetIssuesCard } from "../AddFieldPanel";

test("AddFieldPanel exposes the live add-field methods without manual entry", () => {
  const markup = renderToStaticMarkup(
    <AddFieldPanel workspaceId="workspace-1" />,
  );

  assert.match(markup, /LLD Lookup/);
  assert.match(markup, /Upload CSV/);
  assert.match(markup, /Upload KML/);
  assert.doesNotMatch(markup, /Manual Entry/);
  assert.match(markup, /Lookup LLD/);
  assert.doesNotMatch(markup, /Notes/);
});

test("SpreadsheetIssuesCard renders row-level CSV issues", () => {
  const markup = renderToStaticMarkup(
    <SpreadsheetIssuesCard
      issues={[
        { rowNumber: 4, message: "Missing LLD value." },
        { rowNumber: 7, message: "Area must be a valid number." },
      ]}
    />,
  );

  assert.match(markup, /IMPORT ISSUES/);
  assert.match(markup, /Row 4/);
  assert.match(markup, /Missing LLD value\./);
  assert.match(markup, /Row 7/);
  assert.match(markup, /Area must be a valid number\./);
});
