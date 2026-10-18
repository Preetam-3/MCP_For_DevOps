#!/usr/bin/env node
// doctor: check environment and print fixes.
console.log("=== k8s-readonly doctor ===");

// Node version
import process from "process";
console.log(`Node version: ${process.version}`);
if (parseInt(process.version.slice(1).split(".")[0]) < 18) {
  console.log("FIX: Upgrade Node to >= 18");
} else {
  console.log("PASS: Node >= 18");
}

// Kubeconfig
import { execSync } from "child_process";
try {
  const ctx = execSync("kubectl config current-context", { encoding: "utf8" }).trim();
  console.log(`PASS: kubectl context = ${ctx}`);
} catch (e) {
  console.log("FAIL: kubectl config missing or invalid");
  console.log("FIX: Run scripts/setup.sh or point KUBECONFIG at a valid kubeconfig");
}

// API reachability
try {
  execSync("kubectl version --short 2>/dev/null | head -1", { stdio: "pipe" });
  console.log("PASS: kubectl can reach cluster");
} catch (e) {
  console.log("FAIL: Cluster unreachable (no active API server)");
  console.log("FIX: Start your cluster (e.g. 'k3s server' or 'kind create cluster')");
}

// RBAC check
try {
  const out = execSync("kubectl auth can-i get pods --namespace=default", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  console.log(`PASS/FAIL: auth can-i = ${out}`);
} catch (e) {
  console.log("INFO: auth can-i check skipped (read-only SA expected to return 'no' for writes)");
}

// Metrics server
try {
  execSync("kubectl get --raw /apis/metrics.k8s.io/v1beta1 2>/dev/null", { stdio: "pipe" });
  console.log("PASS: metrics-server available");
} catch (e) {
  console.log("WARN: metrics-server not available (optional for metrics tools)");
  console.log("FIX: Apply metrics-server manifest if you want get_pod_metrics/get_node_metrics");
}

console.log("=== doctor complete ===");
