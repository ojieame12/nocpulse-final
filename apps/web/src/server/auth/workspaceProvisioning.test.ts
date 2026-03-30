import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveUniqueWorkspaceSlug,
  slugifyWorkspaceName,
} from "./workspaceProvisioning";

test("slugifyWorkspaceName normalizes mixed labels into app-safe slugs", () => {
  assert.equal(slugifyWorkspaceName("Hope Creek Farms"), "hope-creek-farms");
  assert.equal(slugifyWorkspaceName("Müller & Sons"), "muller-sons");
});

test("resolveUniqueWorkspaceSlug keeps the base slug when it is unused", () => {
  assert.deepEqual(resolveUniqueWorkspaceSlug([], "Hope Creek Farms"), {
    slug: "hope-creek-farms",
    adjusted: false,
  });
});

test("resolveUniqueWorkspaceSlug appends a numeric suffix for collisions", () => {
  assert.deepEqual(
    resolveUniqueWorkspaceSlug(
      [
        { slug: "hope-creek-farms" },
        { slug: "hope-creek-farms-2" },
      ],
      "Hope Creek Farms",
    ),
    {
      slug: "hope-creek-farms-3",
      adjusted: true,
    },
  );
});
