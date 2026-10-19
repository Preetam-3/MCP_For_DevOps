#!/usr/bin/env node
// verify-readonly: prove the cluster wall holds for THIS credential.
// It can fail: a broken credential, an unreachable cluster or a permission that
// is too wide all produce FAIL, never a silent PASS.
//
// Usage:  KUBECONFIG=./mcp.kubeconfig NAMESPACE=demo k8s-readonly-verify
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const namespace = process.env.NAMESPACE || "demo";
const kubeconfig = process.env.KUBECONFIG || (existsSync("mcp.kubeconfig") ? "mcp.kubeconfig" : "");

if (!kubeconfig) {
  console.error("ERROR: set KUBECONFIG to the scoped credential, e.g. KUBECONFIG=./mcp.kubeconfig");
  process.exit(2);
}

function kubectl(args) {
  const r = spawnSync("kubectl", [`--kubeconfig=${kubeconfig}`, ...args], { encoding: "utf8" });
  if (r.error && r.error.code === "ENOENT") {
    console.error("ERROR: kubectl is not installed or not on PATH");
    process.exit(2);
  }
  return { out: (r.stdout || "").trim(), err: (r.stderr || "").trim(), code: r.status };
}

let failures = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };

console.log("=== k8s-readonly verify (read-only wall proof) ===");
console.log(`Credential : ${kubeconfig}`);
console.log(`Namespace  : ${namespace}\n`);

console.log("--- 1. The credential works and can read ---");
const read = kubectl(["auth", "can-i", "list", "pods", "-n", namespace]);
if (read.out === "yes") pass("can list pods");
else fail(`cannot list pods (got "${read.out || read.err.split("\n")[0]}"). Fix the credential before trusting the checks below.`);

console.log("\n--- 2. Write and sensitive permissions must all be denied ---");
const mustDeny = [
  ["delete", "pods"], ["create", "pods"], ["patch", "pods"], ["update", "pods"],
  ["delete", "deployments"], ["patch", "deployments"],
  ["create", "pods/exec"], ["create", "pods/portforward"],
  ["get", "secrets"],
];
for (const [verb, resource] of mustDeny) {
  const r = kubectl(["auth", "can-i", verb, resource, "-n", namespace]);
  if (r.out === "no") pass(`${verb} ${resource}: denied`);
  else if (r.out === "yes") fail(`${verb} ${resource}: ALLOWED (credential is not read-only)`);
  else fail(`${verb} ${resource}: could not verify (${r.err.split("\n")[0] || "no answer"})`);
}

console.log("\n--- 3. A real write attempt must be rejected with 403 Forbidden ---");
const del = kubectl(["delete", "pod", "verify-readonly-does-not-exist", "-n", namespace]);
const text = `${del.err} ${del.out}`.toLowerCase();
if (del.code !== 0 && text.includes("forbidden")) pass("delete returned 403 Forbidden (cluster wall holds)");
else if (text.includes("not found")) fail("delete was NOT blocked (the API looked for the pod, so RBAC allowed the write)");
else fail(`could not verify (${del.err.split("\n")[0] || "unexpected response"})`);

console.log(`\n=== RESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} problem${failures > 1 ? "s" : ""})`} ===`);
process.exit(failures === 0 ? 0 : 1);
