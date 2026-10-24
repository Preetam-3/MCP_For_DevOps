// Unit tests for the helper libraries. Run: node --test test/lib.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NAMESPACE_ALLOWLIST = "demo,staging"; // must be set before kube.js is imported
const { redact } = await import("../lib/redact.js");
const { capText } = await import("../lib/limits.js");
const { checkNamespace } = await import("../lib/kube.js");
const { isSupportedNode } = await import("../lib/node-version.js");
const { credentialProblem } = await import("../lib/credential.js");
const { formatError } = await import("../lib/errors.js");
const { podStatus, readyCount, pickContainer } = await import("../lib/pod-status.js");
const { sanitizeObject, redactStructured } = await import("../lib/redact.js");

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

test("credentialProblem: refuses to start without KUBECONFIG, allows the safe cases", () => {
  assert.match(credentialProblem({}), /KUBECONFIG/);
  assert.equal(credentialProblem({ KUBECONFIG: "/tmp/mcp.kubeconfig" }), null);
  assert.equal(credentialProblem({ KUBERNETES_SERVICE_HOST: "10.0.0.1" }), null); // in-cluster ServiceAccount
  assert.equal(credentialProblem({ K8S_READONLY_ALLOW_DEFAULT_KUBECONFIG: "1" }), null); // explicit opt-out
  assert.match(credentialProblem({ KUBECONFIG: "   " }), /KUBECONFIG/);
});

const k8sStatus = (message, reason, code) => JSON.stringify(JSON.stringify({ kind: "Status", status: "Failure", message, reason, code }));

test("formatError: 403 explains the namespace-only credential and the --cluster option", () => {
  const out = formatError({ code: 403, message: "HTTP-Code: 403", body: k8sStatus('nodes is forbidden: cannot list resource "nodes"', "Forbidden", 403) });
  assert.match(out, /^403 Forbidden/);
  assert.match(out, /--cluster/);
  assert.match(out, /cannot list resource "nodes"/);
});

test("formatError: a missing previous container becomes a short readable hint", () => {
  const out = formatError({ code: 400, message: "HTTP-Code: 400\nHeaders: {...}", body: k8sStatus('previous terminated container "crasher" in pod "crasher" not found', "BadRequest", 400) });
  assert.match(out, /previous terminated container/);
  assert.match(out, /no earlier run/);
  assert.ok(!out.includes("Headers"));
});

test("formatError: 401, connection failures, allowlist errors and unknown errors", () => {
  assert.match(formatError({ code: 401, message: "HTTP-Code: 401" }), /expired/);
  assert.match(formatError(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:6443"), { code: "ECONNREFUSED" })), /Cannot reach the cluster API/);
  const refused = Object.assign(new Error("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:6443"), { code: "ECONNREFUSED" }) });
  assert.match(formatError(refused), /fetch failed: ECONNREFUSED/);
  const ns = 'Namespace "kube-system" is not in NAMESPACE_ALLOWLIST (demo). Access denied.';
  assert.equal(formatError(new Error(ns)), ns);
  assert.match(formatError(new Error("something odd")), /^Kubernetes error: something odd/);
});

test("formatError: secrets that appear in error text are redacted", () => {
  assert.ok(!formatError(new Error("failed: password=hunter2")).includes("hunter2"));
});

const waiting = (name, reason, extra = {}) => ({ name, ready: false, restartCount: 0, state: { waiting: { reason } }, ...extra });
const running = (name) => ({ name, ready: true, restartCount: 0, state: { running: {} } });

test("podStatus: shows what kubectl shows, not just the phase", () => {
  const crash = { status: { phase: "Running", containerStatuses: [waiting("app", "CrashLoopBackOff", { restartCount: 150 })] } };
  assert.equal(podStatus(crash), "CrashLoopBackOff");
  const pull = { spec: { containers: [{ name: "badimage" }, { name: "istio-proxy" }] }, status: { phase: "Pending", containerStatuses: [waiting("badimage", "ImagePullBackOff"), running("istio-proxy")] } };
  assert.equal(podStatus(pull), "ImagePullBackOff");
  assert.equal(readyCount(pull), "1/2");
  assert.equal(podStatus({ status: { phase: "Running", containerStatuses: [running("a")] } }), "Running");
  assert.equal(podStatus({ status: { phase: "Succeeded", containerStatuses: [{ name: "a", state: { terminated: { reason: "Completed", exitCode: 0 } } }] } }), "Completed");
  assert.equal(podStatus({ metadata: { deletionTimestamp: "2026-01-01T00:00:00Z" }, status: { phase: "Running" } }), "Terminating");
  assert.equal(podStatus({ status: { phase: "Pending", initContainerStatuses: [{ name: "i", state: { waiting: { reason: "PodInitializing" } } }] } }), "Init:0/1");
  assert.equal(podStatus({ status: { phase: "Pending" } }), "Pending");
});

test("pickContainer: prefers the restarting container over a service-mesh sidecar", () => {
  const pod = { spec: { containers: [{ name: "istio-proxy" }, { name: "app" }] }, status: { containerStatuses: [running("istio-proxy"), waiting("app", "CrashLoopBackOff", { restartCount: 3 })] } };
  assert.equal(pickContainer(pod), "app");
});

test("sanitizeObject: masks secret-looking env values, keeps harmless ones, drops noise", () => {
  const pod = { metadata: { name: "a-very-long-pod-name-that-is-over-thirty-two-characters", managedFields: [{ big: "noise" }], annotations: { "kubectl.kubernetes.io/last-applied-configuration": '{"env":[{"name":"DB_PASSWORD","value":"hunter2"}]}' } },
    spec: { containers: [{ name: "c", env: [{ name: "DB_PASSWORD", value: "hunter2" }, { name: "API_TOKEN", value: "abc123" }, { name: "LOG_LEVEL", value: "debug" }, { name: "FROM_SECRET", valueFrom: { secretKeyRef: { name: "s", key: "k" } } }] }] } };
  const out = JSON.stringify(sanitizeObject(pod));
  assert.ok(!out.includes("hunter2") && !out.includes("abc123"));
  assert.ok(!out.includes("managedFields") && !out.includes("noise"));
  assert.ok(out.includes('"LOG_LEVEL"') && out.includes('"debug"'));
  assert.ok(out.includes("a-very-long-pod-name-that-is-over-thirty-two-characters"), "long resource names must survive");
  assert.ok(out.includes("secretKeyRef"), "references to Secrets are kept (names only, no values)");
});

test("redactStructured: masks secrets but never long resource names or UIDs", () => {
  const uid = "8d6f1c1e-4b7a-4d3a-9f1e-0123456789ab";
  assert.equal(redactStructured(`uid ${uid}`), `uid ${uid}`);
  assert.equal(redactStructured("password=hunter2"), "password=***REDACTED***");
});
