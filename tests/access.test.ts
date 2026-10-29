import test from "node:test";
import assert from "node:assert/strict";
import {
  afterSignIn,
  destinations,
  requiresAccount,
  safeDestination,
} from "../src/access";

test("all personal experiences require an account, including direct links", () => {
  for (const path of destinations.filter((p) => p !== "/")) {
    assert.equal(requiresAccount(path), true, path);
    assert.equal(requiresAccount(`${path}/`), true, path);
  }
});
test("introduction, auth, privacy and shared invitations remain public", () => {
  for (const path of [
    "/",
    "/about",
    "/privacy",
    "/account",
    "/reset-password",
    "/invite",
  ]) {
    assert.equal(requiresAccount(path), false, path);
  }
});
test("new accounts start discovery and returning members keep their destination", () => {
  assert.equal(afterSignIn("/", false), "/onboarding");
  assert.equal(afterSignIn("/onboarding", false), "/onboarding");
  assert.equal(afterSignIn("/onboarding", true), "/");
  assert.equal(afterSignIn("/", true), "/");
  assert.equal(afterSignIn("/chloe", true), "/chloe");
  assert.equal(afterSignIn("/reflect", true), "/reflect");
});
test("auth destinations reject outside origins and unexpected routes", () => {
  for (const value of [
    undefined,
    "https://example.com",
    "//example.com",
    "/account",
    "/onboarding?next=https://example.com",
  ]) {
    assert.equal(safeDestination(value), "/");
  }
});
