# Security Policy

## Read-only by design
This MCP server exposes only read-only Kubernetes tools. No delete, patch, scale, restart, exec, create or apply tool exists, and a test (`k8s-mcp/test/server.test.js`) fails the build if one appears.

## Cluster wall
`rbac.yaml` grants only `get`, `list` and `watch` in one namespace, and no access to Secrets or `pods/exec`. The optional `rbac-cluster.yaml` (applied only with `--cluster`) widens reads to nodes, namespaces and other namespaces, still read-only. Any write attempt returns `403 Forbidden` from Kubernetes itself. Run `k8s-readonly-verify` to prove it for your own credential.

## Credential hygiene
- The server refuses to start unless `KUBECONFIG` is set, so it cannot silently run with your admin credential.
- `mcp.kubeconfig` is git-ignored (`*.kubeconfig`). Never commit it.
- `scripts/setup.sh` creates a ServiceAccount token with a short expiry (default 2 hours).
- Log output is redacted for common secret formats (tokens, passwords, API keys, private keys) before it reaches the agent. Redaction is best-effort; do not rely on it as your only protection.

## Reporting a vulnerability
Please use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for security problems.
