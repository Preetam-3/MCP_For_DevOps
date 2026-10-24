// Starts the real server over stdio and checks the code wall through the MCP protocol.
// Run: node --test test/server.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const serverPath = fileURLToPath(new URL("../server.js", import.meta.url));
const MUTATING = /^(create|delete|patch|update|replace|scale|exec|apply|restart|evict|drain|cordon|rollout_restart|port_?forward)/;

let child;
const pending = new Map();
let nextId = 1;

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

before(async () => {
  child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, KUBECONFIG: "/nonexistent-for-tests" },
    stdio: ["pipe", "pipe", "ignore"],
  });
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* ignore non-JSON output */ }
  });
  await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
});

after(() => child.kill());

test("server exposes exactly the 21 expected read-only tools", async () => {
  const { result } = await request("tools/list");
  const names = result.tools.map((t) => t.name).sort();
  assert.equal(names.length, 21);
  for (const expected of ["list_pods", "get_pod_logs", "list_events", "diagnose_pod", "get_node", "list_namespaces"]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
});

test("every tool is marked readOnlyHint and none has a mutating name", async () => {
  const { result } = await request("tools/list");
  for (const tool of result.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} is not marked readOnlyHint`);
    assert.ok(!MUTATING.test(tool.name), `${tool.name} looks like a mutating tool`);
  }
});

test("asking for a mutating tool fails: the code wall holds", async () => {
  for (const name of ["delete_pod", "scale_deployment", "exec_in_pod", "apply_manifest"]) {
    const res = await request("tools/call", { name, arguments: {} });
    const failed = Boolean(res.error) || res.result?.isError === true;
    assert.ok(failed, `${name} unexpectedly succeeded`);
  }
});

test("server offers the 4 diagnostic prompts", async () => {
  const { result } = await request("prompts/list");
  const names = result.prompts.map((p) => p.name).sort();
  assert.deepEqual(names, ["cluster-health-summary", "diagnose-crashloop", "rollout-stuck", "why-is-my-pod-pending"]);
});

test("server refuses to start without KUBECONFIG, so it never silently uses an admin credential", () => {
  const env = { ...process.env };
  delete env.KUBECONFIG;
  delete env.KUBERNETES_SERVICE_HOST;
  delete env.K8S_READONLY_ALLOW_DEFAULT_KUBECONFIG;
  const r = spawnSync(process.execPath, [serverPath], { env, input: "", encoding: "utf8", timeout: 15000 });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /will not start without KUBECONFIG/);
});
