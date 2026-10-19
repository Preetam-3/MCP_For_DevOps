# PowerShell setup for MCP_For_DevOps read-only Kubernetes MCP.
# Creates ServiceAccount + namespace RBAC, builds kubeconfig with real CA.
param(
    [string]$Namespace = "demo",
    [string]$Duration = "2h",
    [switch]$Cluster   # opt-in: also apply rbac-cluster.yaml (all namespaces + nodes)
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")   # always run from the repo root
$SA = "mcp-readonly"

Write-Host "=== MCP_For_DevOps Setup (PowerShell) ==="
Write-Host "Namespace: $Namespace  Duration: $Duration"

Write-Host "--- 1. Namespace ---"
kubectl create namespace $Namespace --dry-run=client -o yaml 2>$null | kubectl apply -f - || Write-Host "Namespace $Namespace exists."

Write-Host "--- 2. ServiceAccount ---"
@"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SA
  namespace: $Namespace
"@ | kubectl apply -f -

Write-Host "--- 3. RBAC ---"
(Get-Content rbac.yaml -Raw) -replace "namespace: demo", "namespace: $Namespace" | kubectl apply -f -
if ($Cluster) {
    (Get-Content rbac-cluster.yaml -Raw) -replace "namespace: demo", "namespace: $Namespace" | kubectl apply -f -
} else {
    Write-Host "Skipping cluster-wide role (namespace-only). Re-run with -Cluster to include nodes and all namespaces."
}

Write-Host "--- 4. Token + kubeconfig (real CA) ---"
$token = (kubectl create token $SA -n $Namespace --duration $Duration).Trim()
$context = kubectl config view --minify -o jsonpath='{.contexts[?(@.name=="'+(kubectl config current-context)+'")].context.namespace}'
if (-not $context) { $context = $Namespace }
$cluster = (kubectl config view --minify -o jsonpath='{.clusters[0].name}')
$server = kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
# Read the CA of the CURRENT context's cluster (same source as $server above).
$caData = (kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
if (-not $caData) {
    $caFile = (kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority}')
    if ($caFile -and (Test-Path $caFile)) {
        $caData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($caFile))
    }
}
if (-not $caData) { throw "Could not find the cluster CA for the current kubectl context." }
$mcpConfig = @"
apiVersion: v1
kind: Config
current-context: mcp
clusters:
- cluster:
    certificate-authority-data: $caData
    server: $server
  name: lab
contexts:
- context:
    cluster: lab
    namespace: $Namespace
    user: $SA
  name: mcp
users:
- name: $SA
  user:
    token: $token
"@
$mcpConfig | Out-File -FilePath "mcp.kubeconfig" -Encoding utf8 -Force
Write-Host "Kubeconfig: $(Resolve-Path mcp.kubeconfig)"

Write-Host "--- Ready-to-paste (Claude Code / Cursor) ---"
Write-Host "claude mcp add k8s-readonly -e KUBECONFIG=`"$(Resolve-Path mcp.kubeconfig)`" -- node k8s-mcp/server.js"
Write-Host "--- Done ---"
