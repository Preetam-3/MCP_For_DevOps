# Contributing

- Keep `.gitignore` strict; never commit `mcp.kubeconfig`, `*.kubeconfig`, tokens or `.env`.
- Use short, descriptive commit messages (for example `fix(setup): ...`, `feat(tools): ...`).
- New Kubernetes tools must be read-only (`get`/`list`/`watch` only) and marked `readOnlyHint: true`. Add the matching permission to `rbac.yaml` only if it is read-only.
- Run `cd k8s-mcp && npm test` before opening a pull request. It checks that no mutating API is used and that the server exposes only read-only tools.
