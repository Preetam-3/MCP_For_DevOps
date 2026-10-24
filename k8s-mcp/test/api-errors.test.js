// End-to-end test against a fake Kubernetes API: checks what the agent actually receives
// when calls succeed or fail. No real cluster needed. Run: node --test test/api-errors.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const serverPath = fileURLToPath(new URL("../server.js", import.meta.url));
const status = (code, reason, message) => JSON.stringify({ kind: "Status", apiVersion: "v1", metadata: {}, status: "Failure", message, reason, code });

let api, child, nextId = 1;
const pending = new Map();

function call(name, args) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout calling ${name}`)), 15000);
    pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }) + "\n");
  });
}
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => { pending.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
}

before(async () => {
  api = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (c, type, body) => { res.writeHead(c, { "content-type": type }); res.end(body); };
    if (u.pathname.endsWith("/pods/crasher/log")) {
      if (u.searchParams.get("previous") === "true") return send(400, "application/json", status(400, "BadRequest", 'previous terminated container "crasher" in pod "crasher" not found'));
      return send(200, "text/plain", "starting\npassword=hunter2\n");
    }
    if (u.pathname === "/api/v1/namespaces/demo/pods/crasher" || u.pathname === "/api/v1/namespaces/demo/pods") {
      const pod = {
        metadata: { name: "crasher", namespace: "demo", creationTimestamp: "2026-10-18T08:00:00Z", uid: "8d6f1c1e-4b7a-4d3a-9f1e-0123456789ab",
          managedFields: [{ manager: "noise" }], annotations: { "kubectl.kubernetes.io/last-applied-configuration": "{\"env\":[{\"name\":\"DB_PASSWORD\",\"value\":\"hunter2\"}]}" } },
        spec: { nodeName: "node1", containers: [{ name: "crasher", env: [{ name: "DB_PASSWORD", value: "hunter2" }, { name: "LOG_LEVEL", value: "debug" }] }, { name: "istio-proxy" }] },
        status: { phase: "Running", containerStatuses: [
          { name: "crasher", ready: false, restartCount: 150, state: { waiting: { reason: "CrashLoopBackOff" } }, lastState: { terminated: { reason: "Error", exitCode: 1 } } },
          { name: "istio-proxy", ready: true, restartCount: 0, state: { running: {} } } ] } };
      return send(200, "application/json", JSON.stringify(u.pathname.endsWith("/pods") ? { kind: "PodList", apiVersion: "v1", metadata: {}, items: [pod] } : { kind: "Pod", apiVersion: "v1", ...pod }));
    }
    if (u.pathname === "/api/v1/namespaces/demo/events") {
      const ev = (reason, message, ts, count) => ({ type: "Warning", reason, message, count, lastTimestamp: ts, metadata: { name: reason } });
      return send(200, "application/json", JSON.stringify({ kind: "EventList", apiVersion: "v1", metadata: {}, items: [ev("Old", "older event", "2026-10-18T08:00:00Z", 1), ev("BackOff", "Back-off restarting failed container", "2026-10-24T08:00:00Z", 232)] }));
    }
    if (u.pathname === "/api/v1/nodes") return send(403, "application/json", status(403, "Forbidden", 'nodes is forbidden: User "mcp-readonly" cannot list resource "nodes" at the cluster scope'));
    send(404, "application/json", status(404, "NotFound", "not found"));
  });
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  const dir = mkdtempSync(join(tmpdir(), "k8s-mcp-test-"));
  const kubeconfig = join(dir, "kubeconfig.yaml");
  writeFileSync(kubeconfig, `apiVersion: v1
kind: Config
current-context: t
clusters: [{name: c, cluster: {server: "http://127.0.0.1:${api.address().port}", insecure-skip-tls-verify: true}}]
users: [{name: u, user: {token: fake}}]
contexts: [{name: t, context: {cluster: c, user: u, namespace: demo}}]
`);
  child = spawn(process.execPath, [serverPath], { env: { ...process.env, KUBECONFIG: kubeconfig, NAMESPACE_ALLOWLIST: "demo" }, stdio: ["pipe", "pipe", "ignore"] });
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    try { const m = JSON.parse(line); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch { /* ignore */ }
  });
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
});

after(() => { child?.kill(); api?.close(); });

const text = (r) => r.result.content[0].text;

test("previous logs that do not exist give a short, readable, flagged error", async () => {
  const r = await call("get_pod_logs", { namespace: "demo", name: "crasher", previous: true });
  assert.equal(r.result.isError, true);
  assert.match(text(r), /previous terminated container/);
  assert.match(text(r), /no earlier run/);
  assert.ok(!text(r).includes("Headers:"), "raw HTTP headers must not reach the agent");
});

test("logs are returned with secrets redacted", async () => {
  const r = await call("get_pod_logs", { namespace: "demo", name: "crasher" });
  assert.ok(!r.result.isError);
  assert.match(text(r), /starting/);
  assert.match(text(r), /password=\*\*\*REDACTED\*\*\*/);
  assert.ok(!text(r).includes("hunter2"));
});

test("a cluster-wide read that RBAC denies explains the namespace-only credential", async () => {
  const r = await call("list_nodes", {});
  assert.equal(r.result.isError, true);
  assert.match(text(r), /^403 Forbidden/);
  assert.match(text(r), /--cluster/);
});

test("list_pods reports the real status, not just the phase", async () => {
  const r = await call("list_pods", { namespace: "demo" });
  assert.ok(!r.result.isError);
  assert.match(text(r), /"status": "CrashLoopBackOff"/);
  assert.match(text(r), /"ready": "1\/2"/);
  assert.match(text(r), /"restarts": 150/);
});

test("get_pod never returns secret-looking env values or the last-applied copy", async () => {
  const r = await call("get_pod", { namespace: "demo", name: "crasher" });
  assert.ok(!r.result.isError);
  assert.ok(!text(r).includes("hunter2"), "inline secret leaked");
  assert.ok(!text(r).includes("managedFields"));
  assert.match(text(r), /"LOG_LEVEL"/);
  assert.match(text(r), /8d6f1c1e-4b7a-4d3a-9f1e-0123456789ab/, "UIDs must not be masked");
});

test("diagnose_pod shows the crash status, last run, newest event first, and redacted logs", async () => {
  const r = await call("diagnose_pod", { namespace: "demo", name: "crasher" });
  assert.ok(!r.result.isError);
  const t = text(r);
  assert.match(t, /Status: CrashLoopBackOff/);
  assert.match(t, /crasher: Waiting: CrashLoopBackOff; last run: Error \(exit 1\)/);
  assert.ok(t.indexOf("Warning/BackOff") < t.indexOf("Warning/Old"), "newest event must come first");
  assert.match(t, /previous run/);
  assert.ok(!t.includes("hunter2"));
});

test("a namespace outside the allowlist is refused before any API call", async () => {
  const r = await call("list_pods", { namespace: "kube-system" });
  assert.equal(r.result.isError, true);
  assert.match(text(r), /NAMESPACE_ALLOWLIST/);
});
