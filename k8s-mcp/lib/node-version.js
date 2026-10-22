// Minimum Node.js version: the Kubernetes client depends on undici 8, which needs Node 22.19+.
export const MIN_NODE = [22, 19, 0];
export const MIN_NODE_TEXT = MIN_NODE.join(".");

export function isSupportedNode(version) {
  const parts = String(version).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const have = parts[i] ?? 0;
    if (have > MIN_NODE[i]) return true;
    if (have < MIN_NODE[i]) return false;
  }
  return true;
}
