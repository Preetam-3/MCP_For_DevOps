#!/usr/bin/env node
// doctor: check the environment and print a fix for anything that is wrong.
// Uses whatever kubectl would use (KUBECONFIG or ~/.kube/config).
import { spawnSync } from "node:child_process";
import { isSupportedNode, MIN_NODE_TEXT } from "../lib/node-version.js";

function kubectl(args) {
  const r = spawnSync("kubectl", args, { encoding: "utf8" });
  if (r.error && r.error.code === "ENOENT") return { missing: true, out: "", err: "", code: 127 };
  return { out: (r.stdout || "").trim(), err: (r.stderr || "").trim(), code: r.status };
}

let failures = 0;
const ok = (m) => console.log(`PASS  ${m}`);
const warn = (m, fix) => { console.log(`WARN  ${m}`); if (fix) console.log(`      fix: ${fix}`); };
const bad = (m, fix) => { console.log(`FAIL  ${m}`); if (fix) console.log(`      fix: ${fix}`); failures++; };

console.log("=== k8s-readonly doctor ===");
console.log(`KUBECONFIG : ${process.env.KUBECONFIG || "(not set, using ~/.kube/config)"}\n`);

if (isSupportedNode(process.versions.node)) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node} is too old`, `install Node ${MIN_NODE_TEXT} or newer`);

const client = kubectl(["version", "--client"]);
if (client.missing) { bad("kubectl is not installed", "install kubectl: https://kubernetes.io/docs/tasks/tools/"); process.exit(1); }
ok("kubectl found");

const ctx = kubectl(["config", "current-context"]);
if (ctx.code === 0 && ctx.out) ok(`current context: ${ctx.out}`);
else bad("no current kubectl context", "point KUBECONFIG at the scoped credential, e.g. KUBECONFIG=./mcp.kubeconfig");

const ver = kubectl(["get", "--raw", "/version"]);
if (ver.code === 0) ok("cluster API reachable");
else bad(`cluster API not reachable (${ver.err.split("\n")[0] || "no response"})`,
  "check the cluster is running; if the error mentions a certificate, re-run scripts/setup.sh");

const nsArgs = process.env.NAMESPACE ? ["-n", process.env.NAMESPACE] : [];
const read = kubectl(["auth", "can-i", "list", "pods", ...nsArgs]);
if (read.out === "yes") ok("credential can list pods");
else bad("credential cannot list pods", "re-run scripts/setup.sh to recreate the read-only identity");

const write = kubectl(["auth", "can-i", "delete", "pods", ...nsArgs]);
if (write.out === "no") ok("credential cannot delete pods (read-only)");
else if (write.out === "yes") bad("credential CAN delete pods: it is NOT read-only", "use the scoped credential from scripts/setup.sh, not an admin kubeconfig");
else warn("could not check delete permission");

const metrics = kubectl(["get", "--raw", "/apis/metrics.k8s.io/v1beta1"]);
if (metrics.code === 0) ok("metrics-server available");
else warn("metrics-server not available (only get_pod_metrics and get_node_metrics need it)", "install metrics-server if you want those tools");

console.log(`\n=== ${failures === 0 ? "all required checks passed" : `${failures} problem${failures > 1 ? "s" : ""} found`} ===`);
process.exit(failures === 0 ? 0 : 1);
