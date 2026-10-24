// Tests scripts/setup.sh with a fake kubectl, so no cluster is touched.
// Run: node --test test/setup.test.js   (needs bash; skipped on Windows)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, chmodSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const skip = process.platform === "win32" ? "setup.sh needs bash" : false;

function sandbox() {
  // Copy the script into a temp "repo" so tests never touch the real mcp.kubeconfig.
  const root = mkdtempSync(join(tmpdir(), "k8s-setup-test-"));
  mkdirSync(join(root, "scripts")); mkdirSync(join(root, "bin"));
  for (const f of ["scripts/setup.sh", "rbac.yaml", "rbac-cluster.yaml"]) copyFileSync(join(repo, f), join(root, f));
  const log = join(root, "kubectl.log");
  writeFileSync(join(root, "bin", "kubectl"), `#!/bin/bash
echo "$*" >> "${log}"
args=("$@"); if [ "\${args[0]}" = "--context" ]; then args=("\${args[@]:2}"); fi
case "\${args[*]}" in
  "config current-context") echo kind-kind ;;
  "config view --minify -o jsonpath={.clusters[0].cluster.server}") printf "https://127.0.0.1:39977" ;;
  "config view --minify --raw -o jsonpath={.clusters[0].cluster.certificate-authority-data}") printf "Q0E=" ;;
  create\\ token*) echo fake.token.value ;;
  apply*) echo "APPLY: $(grep -E '^kind:' | tr '\\n' ' ')" >> "${log}"; echo applied ;;
  create\\ namespace*) echo "kind: Namespace" ;;
esac
`);
  chmodSync(join(root, "bin", "kubectl"), 0o755);
  return { root, log };
}

function run(root, args) {
  return spawnSync("bash", [join(root, "scripts", "setup.sh"), ...args], {
    env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}` },
    input: "", encoding: "utf8", timeout: 20000,
  });
}

test("setup.sh shows the cluster and refuses to change anything without confirmation", { skip }, () => {
  const { root, log } = sandbox();
  const r = run(root, ["demo", "1h"]); // no terminal, no --yes
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Cluster context : kind-kind/);
  assert.match(r.stdout, /https:\/\/127\.0\.0\.1:39977/);
  assert.match(r.stderr, /--yes/);
  assert.ok(!/apply|create token/.test(readFileSync(log, "utf8")), "nothing may be applied before confirmation");
  assert.ok(!existsSync(join(root, "mcp.kubeconfig")));
});

test("setup.sh --yes creates a namespace-only identity and a private kubeconfig", { skip }, () => {
  const { root, log } = sandbox();
  const r = run(root, ["myns", "3h", "--yes"]);
  assert.equal(r.status, 0, r.stderr);
  const calls = readFileSync(log, "utf8");
  assert.ok(!calls.includes("ClusterRole"), "default mode must not apply a ClusterRole");
  assert.match(calls, /create token mcp-readonly -n myns --duration=3h/);
  const cfg = readFileSync(join(root, "mcp.kubeconfig"), "utf8");
  assert.match(cfg, /server: https:\/\/127\.0\.0\.1:39977/);
  assert.match(cfg, /namespace: myns/);
  assert.match(cfg, /certificate-authority-data: Q0E=/);
  assert.equal(statSync(join(root, "mcp.kubeconfig")).mode & 0o777, 0o600);
  assert.match(r.stdout, /belongs to cluster: kind-kind/);
});

test("setup.sh --cluster applies the ClusterRole only when asked", { skip }, () => {
  const { root, log } = sandbox();
  assert.equal(run(root, ["demo", "--cluster", "--yes"]).status, 0);
  assert.match(readFileSync(log, "utf8"), /ClusterRole/);
});

test("setup.sh --context passes the chosen context to every kubectl call", { skip }, () => {
  const { root, log } = sandbox();
  const r = run(root, ["demo", "--context", "prod-ctx", "--yes"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Cluster context : prod-ctx/);
  const calls = readFileSync(log, "utf8").split("\n").filter((l) => l && !l.startsWith("APPLY:"));
  assert.ok(calls.length >= 6);
  for (const c of calls) assert.ok(c.startsWith("--context prod-ctx "), `kubectl call without the chosen context: ${c}`);
});
