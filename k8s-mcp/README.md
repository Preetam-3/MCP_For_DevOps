# k8s-readonly-mcp

A **read-only** Kubernetes MCP server for AI agents. Your agent can see pods, logs, events, deployments, services and nodes, and it **cannot change anything**.

Two independent walls enforce this:

1. **Code wall:** the server registers only read tools (21 of them, all marked `readOnlyHint: true`). No delete, patch, scale, exec or restart tool exists.
2. **Cluster wall:** you give it a ServiceAccount whose RBAC allows only `get`, `list` and `watch`. Kubernetes itself answers `403 Forbidden` to any write.

## Quick start

1. Create the read-only identity and credential (once). This needs the setup script from the repository:

   ```bash
   git clone https://github.com/Preetam-3/MCP_For_DevOps.git
   cd MCP_For_DevOps
   ./scripts/setup.sh demo 2h      # writes ./mcp.kubeconfig
   ```

2. Register the server with your agent:

   ```bash
   claude mcp add k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- npx -y k8s-readonly-mcp
   ```

   Config snippets for Cursor, VS Code, Gemini CLI and Codex CLI are in the repository under `docs/clients/`.

## Check it

```bash
KUBECONFIG=./mcp.kubeconfig NAMESPACE=demo npx -y -p k8s-readonly-mcp k8s-readonly-verify   # proves writes are denied
KUBECONFIG=./mcp.kubeconfig npx -y -p k8s-readonly-mcp k8s-readonly-doctor                  # checks your setup
```

## Configuration

| Variable | Meaning |
|---|---|
| `KUBECONFIG` | Path to the scoped kubeconfig (default: your usual kubectl config) |
| `NAMESPACE_ALLOWLIST` | Comma-separated namespaces the server may read (default: the namespace of the current context) |

## Requirements

Node.js 20 or newer, `kubectl`, and a Kubernetes cluster.

## License

MIT
