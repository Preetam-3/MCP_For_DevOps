# Setup and connection troubleshooting

Contents: Install, Node version, Tools not showing up, 401/token expired, 403 Forbidden, namespace not allowed, metrics unavailable

## Install
```bash
git clone https://github.com/Preetam-3/MCP_For_DevOps.git && cd MCP_For_DevOps
./scripts/setup.sh <namespace> 8h
claude mcp add k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- npx -y k8s-readonly-mcp
```
Add `--cluster` to the setup command only if the user wants node and cross-namespace reads.

## Node version
The server needs Node.js 22.19 or newer. On an older Node it prints a clear message and exits. Fix: install a current Node.js LTS.

## Tools not showing up
The MCP server is not registered or failed to start. Re-run the install from the repo README, then restart the agent session. Run the repo's `doctor` command to check Node version, kubeconfig and API reachability.

## 401 Unauthorized or token expired
The ServiceAccount token expired. Re-run `./scripts/setup.sh <namespace> 8h` from the repository to issue a fresh token, then restart the agent session.

## 403 Forbidden
Expected for any write. For a *read* that returns 403, the Role does not include that resource. Do not widen permissions casually: show the user which resource and verb is missing, and let them decide whether to add it to `rbac.yaml`.

## Namespace not allowed
The server enforces a namespace allowlist. Ask the user to add the namespace to the allowlist setting in the MCP server config.

## Metrics unavailable
metrics-server is not installed. Continue triage without metrics and say so in the report.
