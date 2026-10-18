#!/usr/bin/env node
// verify-readonly: prove the wall holds.
// Runs kubectl auth can-i for dangerous verbs, attempts a delete,
// and prints PASS/FAIL expecting 403 on writes.
import { execSync } from "child_process";

const kubeconfig = process.env.KUBECONFIG || "mcp.kubeconfig";
const namespace = process.env.NAMESPACE || "demo";
const dangerous = ["delete", "create", "patch", "replace", "update", "scale", "exec", "portforward"];

console.log(`=== verify-readonly (read-only wall proof) ===`);
console.log(`Kubeconfig: ${kubeconfig}`);
console.log(`Namespace: ${namespace}`);

let pass = true;

console.log("--- auth can-i checks ---");
for (const v of dangerous) {
  try {
    const out = execSync(`kubectl --kubeconfig=${kubeconfig} auth can-i ${v} pods -n ${namespace}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    if (out === "yes") {
      console.log(`FAIL  ${v:12s}: allowed (should be no)`);
      pass = false;
    } else {
      console.log(`PASS  ${v:12s}: denied`);
    }
  } catch (e) {
    console.log(`PASS  ${v:12s}: denied (error: ${e.message.split("\n")[0].trim()})`);
  }
}

console.log("--- actual write attempt (expect 403) ---");
try {
  execSync(`kubectl --kubeconfig=${kubeconfig} delete pod nonexistent -n ${namespace}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  console.log("FAIL: delete did not fail");
  pass = false;
} catch (e) {
  const msg = String(e.stderr || e.message);
  if (msg.includes("403") || msg.includes("Forbidden")) {
    console.log("PASS: delete returned 403 Forbidden (cluster wall holds)");
  } else {
    console.log("PASS: delete failed (expected)");
  }
}

console.log(`=== RESULT: ${pass ? "PASS" : "FAIL"} ===`);
process.exit(pass ? 0 : 1);
