#!/usr/bin/env bash
set -euo pipefail

# Setup script for MCP_For_DevOps read-only Kubernetes MCP.
# Creates ServiceAccount + namespace-scoped RBAC (default), builds kubeconfig
# with REAL cluster CA data (no --insecure-skip-tls-verify), and prints agent configs.
# Usage: ./scripts/setup.sh [namespace] [duration] (default: demo, 2h)

NAMESPACE="${1:-demo}"
TOKEN_DURATION="${2:-2h}"
SA_NAME="mcp-readonly"

echo "=== MCP_For_DevOps Setup ==="
echo "Namespace: $NAMESPACE"
echo "Token duration: $TOKEN_DURATION"

echo "--- 1. Creating namespace (if needed) ---"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - || echo "Namespace $NAMESPACE already exists."

echo "--- 2. Creating ServiceAccount ---"
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SA_NAME
  namespace: $NAMESPACE
EOF

echo "--- 3. Applying namespace-scoped RBAC (rbac.yaml) ---"
kubectl apply -f rbac.yaml

echo "--- 4. Applying optional ClusterRole (rbac-cluster.yaml) ---"
if [ -f rbac-cluster.yaml ]; then
  kubectl apply -f rbac-cluster.yaml
fi

echo "--- 5. Building kubeconfig with REAL CA (no --insecure-skip-tls-verify) ---"
TOKEN=$(kubectl create token "$SA_NAME" -n "$NAMESPACE" --duration="$TOKEN_DURATION")
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
# Read real CA from kubeconfig file directly (not redacted by kubectl config view)
python3 - <<PY
import yaml, sys
with open("${HOME}/.kube/config") as f:
    d = yaml.safe_load(f)
ca = d["clusters"][0]["cluster"].get("certificate-authority-data", "")
if not ca:
    ca_file = d["clusters"][0]["cluster"].get("certificate-authority", "")
    if ca_file:
        with open(ca_file) as cf:
            import base64
            ca = base64.b64encode(cf.read().encode()).decode()
with open("${CA_OUT:-/tmp/ca.txt}", "w") as out:
    out.write(ca or "")
PY
CA_FILE="${CA_OUT:-/tmp/ca.txt}"
CA_DATA=$(cat "$CA_FILE" 2>/dev/null | tr -d '\n')
rm -f mcp.kubeconfig
cat > mcp.kubeconfig <<EOF
apiVersion: v1
kind: Config
current-context: mcp
clusters:
- cluster:
    certificate-authority-data: $CA_DATA
    server: $SERVER
  name: lab
contexts:
- context:
    cluster: lab
    namespace: $NAMESPACE
    user: $SA_NAME
  name: mcp
users:
- name: $SA_NAME
  user:
    token: $TOKEN
EOF
chmod 600 mcp.kubeconfig
echo "Kubeconfig written: $(pwd)/mcp.kubeconfig"

echo "--- 6. Ready-to-paste agent configs ---"
cat <<AGENTS
# Claude Code
claude mcp add k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- node k8s-mcp/server.js

# Cursor / VS Code Copilot (add to .cursor/mcp.json or settings)
# { "mcpServers": { "k8s-readonly": { "command": "node", "args": ["k8s-mcp/server.js"], "env": { "KUBECONFIG": "$(pwd)/mcp.kubeconfig" } } } }

# Codex CLI
claude mcp add k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- node k8s-mcp/server.js

# Gemini CLI
# Add to agent config: env KUBECONFIG="$(pwd)/mcp.kubeconfig"; command node k8s-mcp/server.js
AGENTS

echo "--- Setup complete ---"
echo "Verify readonly wall: kubectl --kubeconfig=mcp.kubeconfig auth can-i delete pods -n $NAMESPACE (expect: no)"
