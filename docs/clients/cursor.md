# Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "k8s-readonly": {
      "command": "npx",
      "args": ["-y", "k8s-readonly-mcp"],
      "env": {
        "KUBECONFIG": "/path/to/mcp.kubeconfig",
        "NAMESPACE_ALLOWLIST": "demo"
      }
    }
  }
}
```

# VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "k8s-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "k8s-readonly-mcp"],
      "env": {
        "KUBECONFIG": "/path/to/mcp.kubeconfig",
        "NAMESPACE_ALLOWLIST": "demo"
      }
    }
  }
}
```
