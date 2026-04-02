import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Spark } from "../fieldDetailVisualizations";

test("Spark renders negative and mixed values without invalid negative rect heights", () => {
  const markup = renderToStaticMarkup(
    <Spark data={[-0.873, -0.42, 0, 0.13, 0.31]} color="#60a5fa" height={32} />,
  );

  assert.match(markup, /<rect/);
  assert.doesNotMatch(markup, /height="-/);
  assert.doesNotMatch(markup, /y="NaN"/);
  assert.doesNotMatch(markup, /opacity="NaN"/);
});
