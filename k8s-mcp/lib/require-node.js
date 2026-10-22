// Imported first by server.js so an unsupported Node prints a clear message
// instead of crashing later inside a dependency.
import { isSupportedNode, MIN_NODE_TEXT } from "./node-version.js";

if (!isSupportedNode(process.versions.node)) {
  console.error(
    `k8s-readonly-mcp needs Node.js ${MIN_NODE_TEXT} or newer (you have ${process.versions.node}).\n` +
      "Install a current Node.js LTS from https://nodejs.org and try again."
  );
  process.exit(1);
}
