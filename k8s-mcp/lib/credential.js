// The server must use the scoped read-only credential, never the user's default admin kubeconfig.
import { existsSync } from "node:fs";
import { delimiter } from "node:path";

export const ALLOW_DEFAULT_ENV = "K8S_READONLY_ALLOW_DEFAULT_KUBECONFIG";

export function credentialProblem(env = process.env) {
  if (env[ALLOW_DEFAULT_ENV] === "1") return null; // explicit opt-out
  if (env.KUBERNETES_SERVICE_HOST) return null; // running inside a cluster with its own ServiceAccount
  if (env.KUBECONFIG && env.KUBECONFIG.trim()) return null;
  return (
    "k8s-readonly-mcp will not start without KUBECONFIG.\n" +
    "It must point at the read-only credential created by setup (for example mcp.kubeconfig), " +
    "so the agent can never silently use your admin kubeconfig.\n" +
    "Fix: set KUBECONFIG=/full/path/to/mcp.kubeconfig in your agent's MCP server configuration.\n" +
    `(To deliberately use your default kubeconfig, set ${ALLOW_DEFAULT_ENV}=1. Not recommended.)`
  );
}

export function credentialWarning(env = process.env) {
  const first = (env.KUBECONFIG || "").split(delimiter)[0];
  if (first && !existsSync(first)) return `warning: KUBECONFIG file not found: ${first}`;
  return null;
}
