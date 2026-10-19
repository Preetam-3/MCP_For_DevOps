# Contributing

- No AI attribution required in commits.
- Keep `.gitignore` strict; never commit `mcp.kubeconfig`, `*.kubeconfig`, tokens, or `.env`.
- Update `STATUS.md` after each phase.
- Keep commit messages short and descriptive.
- If adding new Kubernetes tools, they must be read-only (`get`/`list`/`watch` only) and marked with `readOnlyHint: true`.
- The `test/safety.js` must pass (no mutating APIs registered).
