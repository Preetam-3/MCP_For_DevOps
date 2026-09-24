# 🔐 Agentic DevOps — Governed Kubernetes Access with MCP + RBAC

> **Connect an AI agent to a real Kubernetes cluster — while proving it can investigate incidents without being able to modify infrastructure.**

This project demonstrates a practical **Agentic DevOps** pattern using **Claude Code, Model Context Protocol (MCP), Kubernetes RBAC, ServiceAccounts, and a local Kubernetes cluster**.

The agent gets live visibility into Kubernetes through a small, purpose-built **read-only MCP server**. The security model is enforced twice:

- **MCP tool boundary:** only read operations are exposed.
- **Kubernetes RBAC boundary:** the ServiceAccount can only `get`/`list` specific resources inside the `demo` namespace.

The result is an agent that can **observe → investigate → diagnose → verify**, but cannot **delete, patch, create, exec, attach, or port-forward**.

---

## 🎥 Project Demo

### Agentic Kubernetes Troubleshooting Demo

This demo shows the AI agent investigating a Kubernetes incident through the read-only MCP server while Kubernetes RBAC prevents mutation.

> **📌 GitHub video:** Upload `Agentic Cluster.mp4` to a GitHub Issue, copy the generated `github.com/user-attachments/assets/...` URL, and replace the placeholder below with that URL. GitHub will render the uploaded video directly in the README.

**Video attachment:**

```text
PASTE-YOUR-GITHUB-VIDEO-ATTACHMENT-URL-HERE
```

**Local demo file:** `Agentic Cluster.mp4` (kept locally; it does not need to be committed to the repository).

---

## 🧠 What This Project Demonstrates

The project answers a practical question:

> **How can an AI agent access real infrastructure without giving the agent unrestricted infrastructure privileges?**

Instead of trusting the model to "behave," the architecture constrains the agent at two independent layers.

```text
                         ┌──────────────────────────┐
                         │       Claude Code        │
                         │        AI Agent          │
                         └────────────┬─────────────┘
                                      │
                              MCP client / stdio
                                      │
                                      ▼
                    ┌───────────────────────────────┐
                    │     Read-Only MCP Server      │
                    │                               │
                    │  list_pods                    │
                    │  get_pod                      │
                    │  pod_logs                      │
                    │  list_events                   │
                    └──────────────┬────────────────┘
                                   │
                           KUBECONFIG
                                   │
                                   ▼
                    ┌───────────────────────────────┐
                    │ Kubernetes ServiceAccount     │
                    │       mcp-readonly            │
                    └──────────────┬────────────────┘
                                   │
                              RBAC / Role
                                   │
                    ┌──────────────▼────────────────┐
                    │        demo namespace         │
                    │                               │
                    │  web Deployment               │
                    │  crasher Pod                  │
                    │  Events                       │
                    │  Pod Logs                     │
                    └───────────────────────────────┘
```

### The two security boundaries

| Layer | Control | Purpose |
|---|---|---|
| **MCP** | Tool surface | The agent can only invoke tools that exist |
| **Kubernetes RBAC** | ServiceAccount permissions | The Kubernetes API decides what the credential can actually do |

This is **defense in depth**.

Even if a future MCP implementation accidentally exposed a mutating operation, the Kubernetes API should still reject it with `403 Forbidden`.

---

## 🛠️ Tech Stack

| Technology | Role |
|---|---|
| **Claude Code** | AI agent / MCP host |
| **Model Context Protocol (MCP)** | Standard interface between the agent and infrastructure |
| **Node.js** | MCP server runtime |
| **@modelcontextprotocol/sdk** | MCP server implementation |
| **@kubernetes/client-node** | Kubernetes API client |
| **Zod** | MCP tool input validation |
| **Kubernetes** | Infrastructure platform |
| **RBAC** | Least-privilege authorization |
| **ServiceAccount** | Dedicated agent identity |
| **stdio** | Local MCP transport |
| **kind / minikube** | Local Kubernetes sandbox |

---

## ✨ Key Features

### 🔎 Read-only Kubernetes investigation

The MCP server exposes exactly four tools:

```text
list_pods
get_pod
pod_logs
list_events
```

There is intentionally **no**:

```text
delete_pod
patch_deployment
create_deployment
exec
attach
port_forward
```

The agent therefore has no MCP tool through which it can directly perform those operations.

### 🔐 Namespace-scoped RBAC

The agent identity is restricted to:

```text
Namespace: demo
ServiceAccount: mcp-readonly
```

Allowed permissions:

```text
pods       → get, list
events     → get, list
pods/log   → get
```

Not allowed:

```text
create
update
patch
delete
watch
exec
attach
port-forward
```

### 🎯 Short-lived credentials

The lab uses:

```bash
kubectl create token mcp-readonly -n demo --duration=1h
```

Instead of relying on a long-lived ServiceAccount Secret token.

### 🧪 Real enforcement test

The project doesn't stop at checking the RBAC YAML.

The **actual credential used by the MCP server** is tested:

```bash
kubectl --kubeconfig=mcp.kubeconfig delete pod crasher -n demo
```

Expected result:

```text
Error from server (Forbidden)
```

While read access continues to work:

```bash
kubectl --kubeconfig=mcp.kubeconfig get pods -n demo
```

This demonstrates that the credential is genuinely read-only.

---

# 🚨 Incident Demonstration

The project creates an intentionally broken pod:

```bash
kubectl run crasher \
  --image=busybox:1.36 \
  --restart=Always \
  -n demo \
  -- /bin/sh -c 'echo starting; sleep 2; exit 1'
```

The pod repeatedly exits with code `1`, causing Kubernetes to report:

```text
CrashLoopBackOff
```

The AI agent investigates the incident using only its read-only MCP tools.

### Investigation flow

```text
                    Incident
                       │
                       ▼
              ┌────────────────┐
              │ list_pods       │
              │ Find unhealthy  │
              │ workload        │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ list_events     │
              │ Observe BackOff │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ get_pod         │
              │ exitCode = 1    │
              │ reason = Error  │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ pod_logs        │
              │ "starting"      │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────────────┐
              │ Root Cause             │
              │ Container exits non-   │
              │ zero on every start    │
              └────────────────────────┘
```

### Important distinction

`CrashLoopBackOff` is **the symptom**, not necessarily the root cause.

In this lab:

```text
Container exits → exitCode 1
        ↓
Kubernetes restarts container
        ↓
Repeated failures
        ↓
Kubernetes applies back-off
        ↓
CrashLoopBackOff
```

The agent can diagnose this completely without write access.

---

# 🏗️ Project Structure

```text
.
├── Agentic Cluster.mp4
├── k8s-mcp/
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── mcp.kubeconfig
└── rbac.yaml
```

### File responsibilities

| File / Directory | Purpose |
|---|---|
| `k8s-mcp/server.js` | Read-only MCP server |
| `k8s-mcp/package.json` | Node.js project configuration |
| `k8s-mcp/package-lock.json` | Locked dependency tree |
| `rbac.yaml` | ServiceAccount, Role and RoleBinding |
| `mcp.kubeconfig` | Scoped credential used by the MCP server |
| `Agentic Cluster.mp4` | Project demonstration |

> ⚠️ **Important:** `mcp.kubeconfig` contains credentials. **Do not commit it to a public GitHub repository.** Generate it locally and add it to `.gitignore`.

Also do **not** commit `node_modules/`.

Recommended `.gitignore`:

```gitignore
node_modules/
mcp.kubeconfig
ca.crt
.env
```

---

# 🚀 Getting Started

## 1. Prerequisites

You need:

- Kubernetes local cluster: **kind** or **minikube**
- `kubectl`
- Node.js 18+
- npm
- Claude Code
- A Linux/macOS shell environment

Check:

```bash
kubectl version --client
kubectl get nodes
node --version
npm --version
claude --version
```

---

## 2. Create the Demo Namespace

```bash
kubectl create namespace demo
```

Create a healthy workload:

```bash
kubectl create deployment web \
  --image=nginx:1.27 \
  --replicas=2 \
  -n demo

kubectl rollout status deployment/web -n demo
```

Create the intentionally failing workload:

```bash
kubectl run crasher \
  --image=busybox:1.36 \
  --restart=Always \
  -n demo \
  -- /bin/sh -c 'echo starting; sleep 2; exit 1'
```

Check:

```bash
kubectl get pods -n demo
```

You should see the `web` pods running and `crasher` repeatedly restarting.

---

# 🔐 3. Apply Least-Privilege RBAC

Apply:

```bash
kubectl apply -f rbac.yaml
```

The RBAC configuration creates:

```text
ServiceAccount
    mcp-readonly
        │
        ▼
Role
    mcp-readonly
        │
        ▼
RoleBinding
    mcp-readonly
```

Verify:

```bash
kubectl get serviceaccount mcp-readonly -n demo
kubectl get role,rolebinding mcp-readonly -n demo
```

---

# 🔑 4. Create a Short-Lived Agent Credential

```bash
TOKEN=$(kubectl create token mcp-readonly \
  -n demo \
  --duration=1h)

SERVER=$(kubectl config view \
  --minify \
  -o jsonpath='{.clusters[0].cluster.server}')
```

Create the scoped kubeconfig:

```bash
kubectl config set-cluster lab \
  --server="$SERVER" \
  --insecure-skip-tls-verify=true \
  --kubeconfig=mcp.kubeconfig

kubectl config set-credentials mcp-readonly \
  --token="$TOKEN" \
  --kubeconfig=mcp.kubeconfig

kubectl config set-context mcp \
  --cluster=lab \
  --user=mcp-readonly \
  --namespace=demo \
  --kubeconfig=mcp.kubeconfig

kubectl config use-context mcp \
  --kubeconfig=mcp.kubeconfig
```

> For a real environment, replace `--insecure-skip-tls-verify=true` with a verified cluster CA. This project demonstrates that hardening step as well.

---

# 🧪 5. Verify the Permission Boundary

Allowed:

```bash
kubectl auth can-i \
  get pods \
  --as=system:serviceaccount:demo:mcp-readonly \
  -n demo
```

Expected:

```text
yes
```

Denied:

```bash
kubectl auth can-i \
  delete pods \
  --as=system:serviceaccount:demo:mcp-readonly \
  -n demo
```

Expected:

```text
no
```

Cross-namespace access:

```bash
kubectl auth can-i \
  get pods \
  --as=system:serviceaccount:demo:mcp-readonly \
  -n kube-system
```

Expected:

```text
no
```

Check the complete effective permission set:

```bash
kubectl auth can-i \
  --list \
  --as=system:serviceaccount:demo:mcp-readonly \
  -n demo
```

---

# 🧩 6. Run the MCP Server

Install dependencies:

```bash
cd k8s-mcp

npm install \
  @modelcontextprotocol/sdk \
  @kubernetes/client-node \
  zod
```

Validate the JavaScript:

```bash
node --check server.js
```

Expected:

```text
server.js parses OK
```

---

# 🔌 7. Connect MCP to Claude Code

From the `k8s-mcp` directory:

```bash
claude mcp add k8s-readonly \
  -e KUBECONFIG="$PWD/../mcp.kubeconfig" \
  -- node "$PWD/server.js"
```

Verify:

```bash
claude mcp list
```

You should see:

```text
k8s-readonly
```

---

# 🤖 8. Investigate Kubernetes Through the Agent

Start Claude Code:

```bash
claude
```

Try prompts such as:

```text
List the pods in the demo namespace and their restart counts.
```

```text
Show me the recent events in the demo namespace for the crasher pod. What is Kubernetes reporting?
```

```text
Read the crasher pod status and identify its last terminated exit code and reason.
```

```text
Show me the logs from the crasher pod and explain the failure.
```

The agent should be able to diagnose the incident using:

```text
list_pods
get_pod
pod_logs
list_events
```

---

# 🛑 9. Prove the Agent Cannot Mutate

Try the real credential:

```bash
kubectl \
  --kubeconfig=mcp.kubeconfig \
  delete pod crasher \
  -n demo
```

Expected:

```text
Error from server (Forbidden)
```

But reads still work:

```bash
kubectl \
  --kubeconfig=mcp.kubeconfig \
  get pods \
  -n demo
```

This is the key security demonstration:

```text
READ  → ✅ allowed
WRITE → ❌ Forbidden
EXEC  → ❌ Forbidden
OTHER NAMESPACE → ❌ Forbidden
```

---

# 🧑‍💻 10. Remediate as the Operator

The agent is intentionally **not** responsible for the write operation.

Use your normal operator credentials:

```bash
kubectl delete pod crasher -n demo
```

Then recreate a healthy version:

```bash
kubectl run crasher \
  --image=busybox:1.36 \
  --restart=Always \
  -n demo \
  -- /bin/sh -c 'echo starting; sleep 3600'
```

Wait for it:

```bash
kubectl wait \
  --for=condition=Ready \
  pod/crasher \
  -n demo \
  --timeout=60s
```

Finally, ask Claude Code to verify:

```text
Re-check the demo namespace. Is the crasher pod healthy now, and has it stopped restarting?
```

The same read-only agent can verify the fix without gaining write access.

---

# 🔒 Security Model

This project intentionally separates **observation** from **remediation**.

```text
             AI AGENT
                 │
                 │ read-only MCP
                 ▼
        ┌──────────────────┐
        │   MCP Server     │
        │                  │
        │  GET / LIST      │
        └────────┬─────────┘
                 │
                 │ scoped credential
                 ▼
        ┌──────────────────┐
        │ Kubernetes RBAC  │
        │                  │
        │ namespace: demo  │
        │ read only        │
        └────────┬─────────┘
                 │
          ┌──────┴──────┐
          │             │
        READ           WRITE
          │             │
          ▼             ▼
        ALLOW         DENY
                       403
```

The important principle is:

> **Don't rely on the model to be safe. Remove dangerous capabilities and enforce the remaining boundary at the infrastructure layer.**

---

# 🧩 MCP Architecture

MCP uses three main participants:

```text
Host
└── Claude Code

Client
└── Connection created by Claude Code for this MCP server

Server
└── k8s-readonly
    ├── list_pods
    ├── get_pod
    ├── pod_logs
    └── list_events
```

This project uses **stdio transport**:

```text
Claude Code
     │
     │ stdin/stdout
     ▼
k8s-readonly MCP Server
     │
     │ Kubernetes API
     ▼
Kubernetes API Server
```

The MCP server must therefore keep diagnostics on `stderr` rather than `stdout`, because stdout carries the JSON-RPC protocol stream.

---

# 🧠 What I Learned

This project focuses on several practical DevOps concepts:

- How MCP connects AI agents to external infrastructure
- MCP host / client / server architecture
- JSON-RPC and stdio transport
- Designing an MCP server with a deliberately constrained tool surface
- Kubernetes ServiceAccounts
- Namespace-scoped RBAC
- Least privilege across **WHAT** and **WHERE**
- Kubernetes subresources such as `pods/log`, `pods/exec`, `pods/attach`, and `pods/portforward`
- Short-lived ServiceAccount tokens
- Kubernetes API authorization with `kubectl auth can-i`
- Using a dedicated kubeconfig for an agent
- Diagnosing `CrashLoopBackOff`
- Distinguishing symptoms from root causes
- Separating AI-driven diagnosis from privileged remediation
- Defense-in-depth for agentic infrastructure access

---

# 📋 Incident Triage Cheat Sheet

| Signal | Meaning |
|---|---|
| `CrashLoopBackOff` | Kubernetes is repeatedly restarting a failed container |
| `exitCode: 1` + `Error` | Container exited with a non-zero status |
| `exitCode: 137` + `OOMKilled` | Container was killed because of memory pressure |
| `ImagePullBackOff` | Kubernetes cannot successfully pull the image |
| `BackOff` event | Kubernetes is backing off between restart attempts |

The critical lesson:

> **`CrashLoopBackOff` describes Kubernetes' response to repeated failures. It does not, by itself, identify the application's root cause.**

---

# 🧹 Cleanup

When finished:

```bash
kubectl delete namespace demo
```

Remove the MCP server from Claude Code:

```bash
claude mcp remove k8s-readonly
```

Delete the local credential:

```bash
rm -f mcp.kubeconfig
```

---

# ⚠️ Security Notes

This project is designed for a **local sandbox cluster**.

Do not blindly copy the lab configuration into production.

In particular:

- Never commit `mcp.kubeconfig`.
- Never expose an MCP server with cluster-admin credentials.
- Prefer namespace-scoped `Role` + `RoleBinding` where possible.
- Do not grant `pods/exec`, `pods/attach`, or `pods/portforward` unless explicitly required.
- Use short-lived credentials for agent workloads.
- Verify TLS instead of using `insecure-skip-tls-verify` outside a throwaway lab.
- Treat MCP tool definitions as part of your security boundary.
- Treat Kubernetes RBAC as the authoritative enforcement layer.

---

# 📚 Learning Path

This implementation follows a three-part hands-on progression:

```text
MCP Fundamentals
       │
       ▼
Kubernetes + MCP + RBAC
       │
       ▼
Incident Troubleshooting
```

### Module 0 — MCP for DevOps

Understand:

- What MCP solves
- Host / client / server
- JSON-RPC
- stdio vs HTTP transport
- Tools, resources, prompts
- Tool surface as a security boundary

### Module 1 — Kubernetes + MCP + RBAC

Build and secure the integration:

- Kubernetes ServiceAccount
- Least-privilege RBAC
- Scoped kubeconfig
- Read-only MCP server
- Claude Code integration
- Permission auditing
- CrashLoopBackOff troubleshooting

---

## ⭐ Core Takeaway

The interesting part of this project isn't simply **"AI can talk to Kubernetes."**

The important engineering pattern is:

```text
AI Agent
   ↓
Constrained Interface
   ↓
Least-Privilege Identity
   ↓
Infrastructure Enforcement
```

The agent can have enough access to **understand and diagnose a real incident** without having enough access to **change the infrastructure it is observing**.

That separation is the foundation for building safer agentic workflows in DevOps and SRE.

---

## 👤 Author

**Preetam Kumar Badatya**

B.Tech CSE · DevOps / Cloud / SRE

- GitHub: [@Preetam-3](https://github.com/Preetam-3)
- LinkedIn: [preetam03](https://linkedin.com/in/preetam03)
- Portfolio: [preetam.framer.ai](https://preetam.framer.ai)
