// Turns Kubernetes client errors into short, readable messages for the agent.
import { redact } from "./redact.js";

function parseBody(body) {
  let value = body;
  for (let i = 0; i < 2 && typeof value === "string"; i++) {
    try { value = JSON.parse(value); } catch { break; }
  }
  return value && typeof value === "object" ? value : null;
}

function statusCode(err, msg) {
  if (typeof err?.code === "number") return err.code;
  if (typeof err?.statusCode === "number") return err.statusCode;
  const m = /HTTP-Code:\s*(\d{3})/.exec(msg);
  return m ? parseInt(m[1], 10) : null;
}

export function formatError(err) {
  const msg = String(err?.message ?? err ?? "unknown error");
  const code = statusCode(err, msg);
  const status = parseBody(err?.body) ?? parseBody((/Body:\s*(.*)/s.exec(msg) || [])[1]?.split("\nHeaders:")[0]?.trim());
  const detail = status?.message ? String(status.message) : "";

  let text;
  if (/^Namespace ".*" is not (allowed|in NAMESPACE_ALLOWLIST)/.test(msg)) {
    text = msg; // our own allowlist message is already clear
  } else if (code === 403 || /\bforbidden\b/i.test(msg)) {
    text = `403 Forbidden: Kubernetes RBAC denied this request${detail ? ` (${detail})` : ""}. ` +
      "This credential is read-only and, by default, limited to one namespace, so writes and cluster-wide reads " +
      "(nodes, namespaces, other namespaces) are refused. For cluster-wide reads the user can re-run the setup with --cluster.";
  } else if (code === 401) {
    text = "401 Unauthorized: the read-only credential was rejected or has expired (its token lasts only as long as the duration chosen at setup). The user must re-run scripts/setup.sh from their copy of the MCP_For_DevOps repository, for example ./scripts/setup.sh <namespace> 24h, and then retry. No other credential is needed.";
  } else if (code === 404) {
    text = `404 Not Found: ${detail || "the resource does not exist"}.`;
  } else if (code === 400) {
    text = `Kubernetes rejected the request (400 ${status?.reason || "BadRequest"}): ${detail || "bad request"}.`;
    if (/previous terminated container/i.test(detail)) text += " There is no earlier run to read; use the current logs and the pod events instead.";
  } else if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|certificate|x509|self.signed/i.test(`${msg} ${err?.code ?? ""} ${err?.cause?.code ?? ""}`)) {
    const cause = err?.cause?.code || err?.cause?.errors?.[0]?.code || String(err?.cause?.message ?? "").split("\n")[0];
    const why = [msg.split("\n")[0], cause].filter(Boolean).join(": ");
    text = `Cannot reach the cluster API (${why}). Check that the cluster is running and that KUBECONFIG points at a valid credential for it (the user can run k8s-readonly-doctor). If the cluster was recreated or the token expired, re-run ./scripts/setup.sh.`;
  } else {
    text = `Kubernetes error${code ? ` (HTTP ${code})` : ""}: ${detail || msg.split("\n")[0]}`;
  }
  return redact(text);
}
