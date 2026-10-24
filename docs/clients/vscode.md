# VS Code (GitHub Copilot, Agent mode)

One command:

```bash
code --add-mcp '{"name":"k8s-readonly","type":"stdio","command":"npx","args":["-y","k8s-readonly-mcp"],"env":{"KUBECONFIG":"/full/path/to/mcp.kubeconfig"}}'
```

Or create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "k8s-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "k8s-readonly-mcp"],
      "env": { "KUBECONFIG": "/full/path/to/mcp.kubeconfig" }
    }
  }
}
```

Then open Copilot Chat in Agent mode and run **MCP: List Servers** from the command palette to confirm it started.
