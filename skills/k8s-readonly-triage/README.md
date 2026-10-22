# Kubernetes Read-Only Incident Triage (skill)

Teaches your AI agent a proven workflow for diagnosing broken pods, rollouts and nodes, using a **read-only** Kubernetes MCP server. The agent can look at almost everything and **can change nothing**: no delete, patch, scale or exec tool exists, and the credential is limited to `get`, `list` and `watch` by Kubernetes RBAC.

## What you get
- A step-by-step triage workflow: scope, pods, events, logs, rollout, services, nodes
- Runbooks for CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending, failed rollouts, probe failures, missing endpoints and node NotReady
- A fixed report format: symptom, evidence, root cause, fix commands for you, how to verify
- A reference of all 21 read-only tools
- Guardrails: the agent never asks for broader credentials and never claims it fixed something

## Requirements
- Node.js 22.19+, `kubectl`, and access to a Kubernetes cluster
- The `k8s-readonly` MCP server (free, MIT licensed): https://github.com/Preetam-3/MCP_For_DevOps

## Install
1. Install the MCP server once:
   ```bash
   git clone https://github.com/Preetam-3/MCP_For_DevOps.git && cd MCP_For_DevOps
   ./scripts/setup.sh <namespace> 8h
   claude mcp add k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- npx -y k8s-readonly-mcp
   ```
2. Copy this `k8s-readonly-triage` folder into your agent's skills directory (for Claude Code: `~/.claude/skills/` or `.claude/skills/` in your project).
3. Ask your agent: "Why is my pod crashing in the demo namespace?"

## Safety
The default credential is limited to one namespace and cannot read Secrets. Prove it any time with `KUBECONFIG=./mcp.kubeconfig NAMESPACE=<namespace> npx -y -p k8s-readonly-mcp k8s-readonly-verify`.

## Files
- `SKILL.md`: the skill itself
- `references/`: runbooks, tool reference, setup troubleshooting
- `examples/`: two worked investigations
