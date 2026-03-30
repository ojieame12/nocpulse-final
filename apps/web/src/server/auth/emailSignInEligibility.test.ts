import test from "node:test";
import assert from "node:assert/strict";
import { deriveEmailSignInPolicy } from "./emailSignInEligibility";

test("deriveEmailSignInPolicy allows provisioned first-time users and creates auth users for them", () => {
  assert.deepEqual(
    deriveEmailSignInPolicy({
      hasProvision: true,
      hasWorkspaceMembership: false,
    }),
    {
      canRequestSignIn: true,
      shouldCreateUser: true,
    },
  );
});

test("deriveEmailSignInPolicy allows existing workspace members without reopening signup", () => {
  assert.deepEqual(
    deriveEmailSignInPolicy({
      hasProvision: false,
      hasWorkspaceMembership: true,
    }),
    {
      canRequestSignIn: true,
      shouldCreateUser: false,
    },
  );
});

test("deriveEmailSignInPolicy rejects emails with neither a provision nor a workspace membership", () => {
  assert.deepEqual(
    deriveEmailSignInPolicy({
      hasProvision: false,
      hasWorkspaceMembership: false,
    }),
    {
      canRequestSignIn: false,
      shouldCreateUser: false,
    },
  );
});
