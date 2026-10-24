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

test("a namespace outside the allowlist is refused before any API call", async () => {
  const r = await call("list_pods", { namespace: "kube-system" });
  assert.equal(r.result.isError, true);
  assert.match(text(r), /NAMESPACE_ALLOWLIST/);
});
