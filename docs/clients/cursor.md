# Cursor / VS Code Copilot (.cursor/mcp.json or settings.json)
{
  "mcpServers": {
    "k8s-readonly": {
      "command": "node",
      "args": ["/path/to/k8s-mcp/server.js"],
      "env": {
        "KUBECONFIG": "/path/to/mcp.kubeconfig",
        "NAMESPACE_ALLOWLIST": "demo"
      }
    }
  }
}
