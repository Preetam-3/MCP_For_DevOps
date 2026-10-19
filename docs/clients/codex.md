# Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.k8s-readonly]
command = "npx"
args = ["-y", "k8s-readonly-mcp"]
env = { KUBECONFIG = "/path/to/mcp.kubeconfig" }
```
