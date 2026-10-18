# Setup and connection troubleshooting

Contents: Tools not showing up, 401/token expired, 403 Forbidden, namespace not allowed, metrics unavailable

## Tools not showing up
The MCP server is not registered or failed to start. Re-run the install from the repo README, then restart the agent session. Run the repo's `doctor` command to check Node version, kubeconfig and API reachability.

## 401 Unauthorized or token expired
The ServiceAccount token expired. Re-run `scripts/setup.sh` (or the renew step in the README) to issue a fresh token, then restart the agent session.

## 403 Forbidden
Expected for any write. For a *read* that returns 403, the Role does not include that resource. Do not widen permissions casually: show the user which resource and verb is missing, and let them decide whether to add it to `rbac.yaml`.

## Namespace not allowed
The server enforces a namespace allowlist. Ask the user to add the namespace to the allowlist setting in the MCP server config.

## Metrics unavailable
metrics-server is not installed. Continue triage without metrics and say so in the report.
