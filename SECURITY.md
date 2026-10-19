# Security Policy

## Read-only by design
This MCP server exposes only read-only Kubernetes tools. No delete, patch, scale, restart, exec, create, or apply tool exists.

## Cluster wall
The `rbac.yaml` grants only `get`, `list`, `watch` verbs. The `rbac-cluster.yaml` extends this to nodes/namespaces/metrics. Any write attempt returns `403 Forbidden` enforced by Kubernetes RBAC.

## Credential hygiene
- `mcp.kubeconfig` is git-ignored (`.gitignore` covers `*.kubeconfig`).
- The setup script (`scripts/setup.sh`) creates a fresh ServiceAccount token with a short expiry (default 2h).
- The historical token (`commit a88e1b7`) is expired and must be purged from git history before making this repo public.

## Reporting issues
Report security concerns by opening a private issue or contacting the repo owner directly.
