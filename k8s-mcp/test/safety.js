#!/usr/bin/env node
// SAFETY TEST: fail the build if any registered tool handler uses a mutating Kubernetes API.
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MUTATING_VERBS = ["create", "delete", "patch", "replace", "update", "scale", "exec", "portforward", "apply", "evict", "restart"];
const MUTATING_METHODS = ["create", "delete", "patch", "replace", "update", "scale", "post", "put"];

const files = [
  ...fs.readdirSync(join(__dirname, "..", "tools")).filter(f => f.endsWith(".js")),
  "server.js",
];
let fail = false;
for (const f of files) {
  if (!f.endsWith(".js")) continue;
  const dir = f === "server.js" ? join(__dirname, "..") : join(__dirname, "..", "tools");
  const content = fs.readFileSync(join(dir, f), "utf8");
const badPatterns = [
    ".createNamespaced", ".deleteNamespaced", ".patchNamespaced", ".replaceNamespaced", ".updateNamespaced",
    ".createClusterScoped", ".deleteClusterScoped", ".patchClusterScoped",
    ".createNode", ".deleteNode", ".patchNode",
    ".postNamespaced", ".putNamespaced",
    ".scaleNamespaced", ".scaleSubresource",
    ".createCollection", ".deleteCollection",
  ];
  for (const bp of badPatterns) {
    if (content.includes(bp)) {
      console.error(`SAFETY FAIL: ${f} contains mutating SDK call: ${bp}`);
      fail = true;
    }
  }
}
if (fail) {
  console.error("SAFETY TEST FAILED: mutating Kubernetes API detected in tool files.");
  process.exit(1);
} else {
  console.log("SAFETY TEST PASSED: no mutating APIs found in tools/.");
  process.exit(0);
}
