import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRequestAccessSubmission,
  renderRequestAccessNotificationEmail,
  RequestAccessSubmissionError,
  resolveRequestAccessNotificationRecipients,
} from "./requestAccess";

test("normalizeRequestAccessSubmission trims and normalizes request-access payloads", () => {
  assert.deepEqual(
    normalizeRequestAccessSubmission({
      name: "  Jane Doe  ",
      email: "  JANE@Example.com ",
      farmName: "  Doe Family Farms  ",
      acreage: " 450 ha ",
      message: " Looking for a field trial. ",
    }),
    {
      name: "Jane Doe",
      email: "jane@example.com",
      farmName: "Doe Family Farms",
      acreage: "450 ha",
      message: "Looking for a field trial.",
    },
  );
});

test("normalizeRequestAccessSubmission rejects invalid or missing required fields", () => {
  assert.throws(
    () =>
      normalizeRequestAccessSubmission({
        name: "",
        email: "not-an-email",
        farmName: "",
      }),
    RequestAccessSubmissionError,
  );
});

test("resolveRequestAccessNotificationRecipients deduplicates and filters invalid recipients", () => {
  assert.deepEqual(
    resolveRequestAccessNotificationRecipients(
      "ops@nocpulse.org, SALES@nocpulse.org; invalid\nops@nocpulse.org",
    ),
    ["ops@nocpulse.org", "sales@nocpulse.org"],
  );
});

test("renderRequestAccessNotificationEmail includes lead details", () => {
  const rendered = renderRequestAccessNotificationEmail({
    name: "Jane Doe",
    email: "jane@example.com",
    farmName: "Doe Family Farms",
    acreage: "450 ha",
    message: "Interested in season-long monitoring.",
  });

  assert.equal(rendered.subject, "New NocPulse access request: Jane Doe");
  assert.match(rendered.html, /Doe Family Farms/);
  assert.match(rendered.text, /Interested in season-long monitoring\./);
});
