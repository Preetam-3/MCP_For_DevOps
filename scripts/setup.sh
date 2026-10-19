#!/usr/bin/env bash
set -euo pipefail

# Setup script for MCP_For_DevOps read-only Kubernetes MCP.
# Creates ServiceAccount + namespace-scoped RBAC (default), builds kubeconfig
# with REAL cluster CA data (no --insecure-skip-tls-verify), and prints agent configs.
# Usage: ./scripts/setup.sh [namespace] [duration] [--cluster]
#   default: namespace "demo", token duration 2h, namespace-scoped access only.
#   --cluster also applies rbac-cluster.yaml (all namespaces + nodes). Opt-in only.

cd "$(dirname "$0")/.."   # always run from the repo root

CLUSTER_MODE=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --cluster) CLUSTER_MODE=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
NAMESPACE="${POSITIONAL[0]:-demo}"
TOKEN_DURATION="${POSITIONAL[1]:-2h}"
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
sed "s/namespace: demo/namespace: $NAMESPACE/g" rbac.yaml | kubectl apply -f -

if [ "$CLUSTER_MODE" = true ]; then
  echo "--- 4. Applying cluster-wide read-only ClusterRole (--cluster) ---"
  sed "s/namespace: demo/namespace: $NAMESPACE/g" rbac-cluster.yaml | kubectl apply -f -
else
  echo "--- 4. Skipping cluster-wide role (namespace-only). Re-run with --cluster to also read nodes, namespaces and other namespaces. ---"
fi

echo "--- 5. Building kubeconfig with REAL CA (no --insecure-skip-tls-verify) ---"
TOKEN=$(kubectl create token "$SA_NAME" -n "$NAMESPACE" --duration="$TOKEN_DURATION")
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
# Read the CA of the CURRENT context's cluster (same source as $SERVER above).
# --raw keeps the certificate data unredacted. No Python or PyYAML needed.
CA_DATA=$(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
if [ -z "$CA_DATA" ]; then
  CA_PATH=$(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority}')
  if [ -n "$CA_PATH" ] && [ -f "$CA_PATH" ]; then
    CA_DATA=$(base64 < "$CA_PATH" | tr -d '\n')
  fi
fi
if [ -z "$CA_DATA" ]; then
  echo "ERROR: could not find the cluster CA for the current kubectl context." >&2
  echo "Check: kubectl config current-context" >&2
  exit 1
fi
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
claude mcp add k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- npx -y k8s-readonly-mcp

# Cursor (.cursor/mcp.json), Gemini CLI (~/.gemini/settings.json), VS Code (.vscode/mcp.json), Codex CLI (config.toml):
# copy the snippet for your agent from docs/clients/ and set KUBECONFIG to:
#   $(pwd)/mcp.kubeconfig
AGENTS

echo "--- Setup complete ---"
echo "Verify readonly wall: kubectl --kubeconfig=mcp.kubeconfig auth can-i delete pods -n $NAMESPACE (expect: no)"
