# Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "k8s-readonly": {
      "command": "npx",
      "args": ["-y", "k8s-readonly-mcp"],
      "env": { "KUBECONFIG": "/path/to/mcp.kubeconfig" }
    }
  }
}
```
