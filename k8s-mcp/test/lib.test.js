// Unit tests for the helper libraries. Run: node --test test/lib.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NAMESPACE_ALLOWLIST = "demo,staging"; // must be set before kube.js is imported
const { redact } = await import("../lib/redact.js");
const { capText } = await import("../lib/limits.js");
const { checkNamespace } = await import("../lib/kube.js");
const { isSupportedNode } = await import("../lib/node-version.js");

test("redact: removes JWTs and bearer tokens", () => {
  const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";
  assert.ok(!redact(`token was ${jwt} ok`).includes(jwt));
  assert.ok(!redact("Authorization: Bearer abc.def-ghi").includes("abc.def-ghi"));
});

test("redact: removes key=value, key: value and JSON secrets but keeps the key", () => {
  assert.equal(redact("password=hunter2"), "password=***REDACTED***");
  assert.equal(redact("password: hunter2"), "password: ***REDACTED***");
  assert.equal(redact('{"api_key":"abcd1234efgh"}'), '{"api_key":"***REDACTED***"}');
});

test("redact: removes cloud and GitHub credentials and private keys", () => {
  assert.ok(!redact("key AKIAIOSFODNN7EXAMPLE end").includes("AKIAIOSFODNN7EXAMPLE"));
  assert.ok(!redact("ghp_" + "a".repeat(30)).includes("aaaaaaaaaa"));
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----";
  assert.ok(!redact(`x ${pem} y`).includes("MIIabc"));
});

test("redact: leaves ordinary log lines alone", () => {
  const line = "pod web-5d4f8c7b9d-abcde CrashLoopBackOff: Back-off restarting failed container";
  assert.equal(redact(line), line);
});

test("capText: short text passes through, long text is truncated and says so", () => {
  assert.equal(capText("a\nb"), "a\nb");
  const long = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
  const out = capText(long, 200);
  assert.ok(out.includes("[TRUNCATED"));
  assert.ok(out.split("\n").length < 210);
});

test("checkNamespace: allows listed namespaces, refuses everything else", () => {
  assert.equal(checkNamespace("demo"), true);
  assert.equal(checkNamespace("staging"), true);
  assert.throws(() => checkNamespace("kube-system"), /not in NAMESPACE_ALLOWLIST/);
});

test("isSupportedNode: accepts 22.19+ and rejects older versions", () => {
  assert.equal(isSupportedNode("22.19.0"), true);
  assert.equal(isSupportedNode("v22.22.2"), true);
  assert.equal(isSupportedNode("24.1.0"), true);
  assert.equal(isSupportedNode("22.18.9"), false);
  assert.equal(isSupportedNode("20.20.2"), false);
  assert.equal(isSupportedNode("18.0.0"), false);
});
