# Changelog

## 1.0.2 (2026-10-24)
- Errors: connection failures now include the underlying cause (for example ECONNREFUSED) instead of only "fetch failed".
- Skill: use only the k8s-readonly tools, never read credential files, and stop and report when the cluster is unreachable.
- Docs: stated the scope of the read-only guarantee (an agent with a shell can use other credentials).

## 1.0.1 (2026-10-23)
- Safety: the server refuses to start unless `KUBECONFIG` is set (escape hatch: `K8S_READONLY_ALLOW_DEFAULT_KUBECONFIG=1`), so it can never silently use an admin credential.
- Errors: failed calls now return a short readable message and are flagged `isError`. A missing previous-container log, an RBAC denial on a cluster-wide read, an expired token and an unreachable cluster each get a clear explanation. Raw HTTP headers no longer reach the agent.
- Skill: added hard rules (evidence only, read events first, do not over-call crashing, always use the report format).
- Docs: `claude mcp add --scope user`, Kilo and VS Code setup.
- Tests: 21 tests, including an end-to-end test against a fake Kubernetes API.

## 1.0.0 (2026-10-22)
- Read-only Kubernetes MCP server (k8s-readonly)
- 21 read-only tools with `readOnlyHint: true`
- Namespace allowlist (`NAMESPACE_ALLOWLIST`), log redaction, output caps
- Setup scripts (`scripts/setup.sh`, `.ps1`), `verify-readonly`, `doctor`
- Dockerfile (non-root user)
- Skill folder (`skills/k8s-readonly-triage/`) aligned with real tools
- MIT License added
