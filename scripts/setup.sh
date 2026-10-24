#!/usr/bin/env bash
set -euo pipefail

# Setup script for MCP_For_DevOps read-only Kubernetes MCP.
# Creates ServiceAccount + namespace-scoped RBAC (default), builds kubeconfig
# with REAL cluster CA data (no --insecure-skip-tls-verify), and prints agent configs.
# Usage: ./scripts/setup.sh [namespace] [duration] [--cluster] [--context NAME] [--yes]
#   default: namespace "demo", token duration 2h, namespace-scoped access only.
#   --cluster       also applies rbac-cluster.yaml (all namespaces + nodes). Opt-in only.
#   --context NAME  use this kubectl context instead of the current one.
#   --yes           do not ask for confirmation (needed when there is no terminal, e.g. CI).
# The script always shows which cluster it is about to change and asks first.

cd "$(dirname "$0")/.."   # always run from the repo root

CLUSTER_MODE=false
ASSUME_YES=false
CONTEXT=""
POSITIONAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    --cluster) CLUSTER_MODE=true ;;
    --yes|-y) ASSUME_YES=true ;;
    --context) shift; CONTEXT="${1:-}" ;;
    --context=*) CONTEXT="${1#--context=}" ;;
    *) POSITIONAL+=("$1") ;;
  esac
  shift
done
NAMESPACE="${POSITIONAL[0]:-demo}"
TOKEN_DURATION="${POSITIONAL[1]:-2h}"
SA_NAME="mcp-readonly"

# Every kubectl call goes through k() so --context applies everywhere.
KUBECTL=(kubectl)
if [ -n "$CONTEXT" ]; then KUBECTL=(kubectl --context "$CONTEXT"); fi
k() { "${KUBECTL[@]}" "$@"; }

CTX_NAME="${CONTEXT:-$(k config current-context)}"
SERVER=$(k config view --minify -o jsonpath='{.clusters[0].cluster.server}')

echo "=== MCP_For_DevOps Setup ==="
echo "Cluster context : $CTX_NAME"
echo "API server      : $SERVER"
echo "Namespace       : $NAMESPACE"
echo "Token duration  : $TOKEN_DURATION"
if [ "$CLUSTER_MODE" = true ]; then
  echo "Access          : read-only, ALL namespaces and nodes (--cluster)"
else
  echo "Access          : read-only, namespace \"$NAMESPACE\" only"
fi
echo
echo "This creates a read-only identity (ServiceAccount, Role, RoleBinding) in that cluster."
if [ "$ASSUME_YES" != true ]; then
  if [ ! -t 0 ]; then
    echo "ERROR: no terminal to ask for confirmation. Re-run with --yes to proceed." >&2
    exit 1
  fi
  read -r -p "Is that the right cluster? Continue? [y/N] " ANSWER
  case "$ANSWER" in
    y|Y|yes|YES) ;;
    *) echo "Aborted. Nothing was changed."; exit 1 ;;
  esac
fi

echo "--- 1. Creating namespace (if needed) ---"
k create namespace "$NAMESPACE" --dry-run=client -o yaml 2>/dev/null | k apply -f - || echo "Namespace $NAMESPACE already exists."

echo "--- 2. Creating ServiceAccount ---"
k apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SA_NAME
  namespace: $NAMESPACE
EOF

echo "--- 3. Applying namespace-scoped RBAC (rbac.yaml) ---"
sed "s/namespace: demo/namespace: $NAMESPACE/g" rbac.yaml | k apply -f -

if [ "$CLUSTER_MODE" = true ]; then
  echo "--- 4. Applying cluster-wide read-only ClusterRole (--cluster) ---"
  sed "s/namespace: demo/namespace: $NAMESPACE/g" rbac-cluster.yaml | k apply -f -
else
  echo "--- 4. Skipping cluster-wide role (namespace-only). Re-run with --cluster to also read nodes, namespaces and other namespaces. ---"
fi

echo "--- 5. Building kubeconfig with REAL CA (no --insecure-skip-tls-verify) ---"
TOKEN=$(k create token "$SA_NAME" -n "$NAMESPACE" --duration="$TOKEN_DURATION")
# Read the CA of the CURRENT context's cluster (same source as $SERVER above).
# --raw keeps the certificate data unredacted. No Python or PyYAML needed.
CA_DATA=$(k config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
if [ -z "$CA_DATA" ]; then
  CA_PATH=$(k config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority}')
  if [ -n "$CA_PATH" ] && [ -f "$CA_PATH" ]; then
    CA_DATA=$(base64 < "$CA_PATH" | tr -d '\n')
  fi
fi
if [ -z "$CA_DATA" ]; then
  echo "ERROR: could not find the cluster CA for the current kubectl context." >&2
  echo "Check: kubectl config get-contexts" >&2
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
echo "This credential belongs to cluster: $CTX_NAME ($SERVER)"

echo "--- 6. Ready-to-paste agent configs ---"
cat <<AGENTS
# Claude Code
claude mcp add --scope user k8s-readonly -e KUBECONFIG="$(pwd)/mcp.kubeconfig" -- npx -y k8s-readonly-mcp

# Cursor, VS Code, Kilo, Gemini CLI or Codex CLI: copy the snippet for your agent from docs/clients/
# and set KUBECONFIG to:
#   $(pwd)/mcp.kubeconfig
AGENTS

echo "--- Setup complete ---"
echo "Verify readonly wall: kubectl --kubeconfig=mcp.kubeconfig auth can-i delete pods -n $NAMESPACE (expect: no)"
