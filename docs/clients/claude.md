# Claude Code

```bash
claude mcp add k8s-readonly -e KUBECONFIG="/path/to/mcp.kubeconfig" -- npx -y k8s-readonly-mcp
```

Optional: limit which namespaces the agent may read by adding `-e NAMESPACE_ALLOWLIST="demo,staging"`.
