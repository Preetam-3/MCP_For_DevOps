# Kilo (CLI v7 and the Kilo Code extension)

`kilo mcp add` is an interactive wizard and does not accept Claude-style flags. The simplest way is to edit the config file. For the Kilo CLI this is `~/.config/kilo/kilo.jsonc` (or a `kilo.jsonc` in your project). Merge this into the file, do not replace it:

```jsonc
{
  "mcp": {
    "k8s-readonly": {
      "type": "local",
      "command": ["npx", "-y", "k8s-readonly-mcp"],
      "environment": { "KUBECONFIG": "/full/path/to/mcp.kubeconfig" }
    }
  }
}
```

Check it with `kilo mcp list`. Kilo may auto-approve MCP tool calls; that is safe here because every tool is read-only.

To add the triage skill, run `npx skills add Preetam-3/MCP_For_DevOps` and choose your agent when asked.
