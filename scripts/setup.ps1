# PowerShell setup for MCP_For_DevOps read-only Kubernetes MCP.
# Creates ServiceAccount + namespace RBAC, builds kubeconfig with real CA.
param(
    [string]$Namespace = "demo",
    [string]$Duration = "2h",
    [switch]$Cluster,   # opt-in: also apply rbac-cluster.yaml (all namespaces + nodes)
    [string]$Context = "",   # use this kubectl context instead of the current one
    [switch]$Yes   # do not ask for confirmation
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")   # always run from the repo root
$SA = "mcp-readonly"
$ctxArgs = @()
if ($Context) { $ctxArgs = @("--context", $Context) }

Write-Host "=== MCP_For_DevOps Setup (PowerShell) ==="
Write-Host "Namespace: $Namespace  Duration: $Duration"
$ctxName = if ($Context) { $Context } else { (kubectl config current-context) }
$server0 = (kubectl @ctxArgs config view --minify -o jsonpath='{.clusters[0].cluster.server}')
Write-Host "Cluster context : $ctxName"
Write-Host "API server      : $server0"
Write-Host "This creates a read-only identity (ServiceAccount, Role, RoleBinding) in that cluster."
if (-not $Yes) {
    $answer = Read-Host "Is that the right cluster? Continue? [y/N]"
    if ($answer -notmatch '^(y|yes)$') { Write-Host "Aborted. Nothing was changed."; exit 1 }
}

Write-Host "--- 1. Namespace ---"
kubectl @ctxArgs create namespace $Namespace --dry-run=client -o yaml 2>$null | kubectl @ctxArgs apply -f - || Write-Host "Namespace $Namespace exists."

Write-Host "--- 2. ServiceAccount ---"
@"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SA
  namespace: $Namespace
"@ | kubectl @ctxArgs apply -f -

Write-Host "--- 3. RBAC ---"
(Get-Content rbac.yaml -Raw) -replace "namespace: demo", "namespace: $Namespace" | kubectl @ctxArgs apply -f -
if ($Cluster) {
    (Get-Content rbac-cluster.yaml -Raw) -replace "namespace: demo", "namespace: $Namespace" | kubectl @ctxArgs apply -f -
} else {
    Write-Host "Skipping cluster-wide role (namespace-only). Re-run with -Cluster to include nodes and all namespaces."
}

Write-Host "--- 4. Token + kubeconfig (real CA) ---"
$token = (kubectl @ctxArgs create token $SA -n $Namespace --duration $Duration).Trim()
$context = kubectl @ctxArgs config view --minify -o jsonpath='{.contexts[?(@.name=="'+(kubectl @ctxArgs config current-context)+'")].context.namespace}'
if (-not $context) { $context = $Namespace }
$cluster = (kubectl @ctxArgs config view --minify -o jsonpath='{.clusters[0].name}')
$server = kubectl @ctxArgs config view --minify -o jsonpath='{.clusters[0].cluster.server}'
# Read the CA of the CURRENT context's cluster (same source as $server above).
$caData = (kubectl @ctxArgs config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
if (-not $caData) {
    $caFile = (kubectl @ctxArgs config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority}')
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
Write-Host "claude mcp add --scope user k8s-readonly -e KUBECONFIG=`"$(Resolve-Path mcp.kubeconfig)`" -- npx -y k8s-readonly-mcp"
Write-Host "--- Done ---"
