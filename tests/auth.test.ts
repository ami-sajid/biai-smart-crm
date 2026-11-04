import { test } from "node:test";
import assert from "node:assert/strict";
import { token, valid, secret, equal } from "../lib/auth";
test("session signatures reject alteration and expiry", () => {
  process.env.REVIEWER_ACCESS_CODE = "test-only-review-code-123456789";
  const exp = Date.now() + 3600000;
  assert.ok(valid(token(exp)));
  assert.equal(valid(token(exp) + "x"), false);
  assert.equal(valid(token(Date.now() - 1)), false);
  assert.equal(valid(token(Date.now() + 10 * 3600000)), false);
  delete process.env.REVIEWER_ACCESS_CODE;
});
test("shared database access fails closed without strong code", () => {
  process.env.REVIEWER_ACCESS_CODE = "short";
  assert.throws(() => secret(), /at least 16/);
  delete process.env.REVIEWER_ACCESS_CODE;
  assert.throws(() => secret(), /at least 16/);
});
test("access-code comparison handles different lengths safely", () => {
  assert.ok(equal("same", "same"));
  assert.equal(equal("same", "different"), false);
});
