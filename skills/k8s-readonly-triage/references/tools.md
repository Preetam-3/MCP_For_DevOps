# Tool reference (read-only)

All tools are read-only. Namespaced tools take `namespace`; if it is omitted the server uses the namespace of the current kubeconfig context. Output is size-capped, and secret-looking strings are masked: environment variable values with secret-like names, tokens, passwords and keys. Noisy fields (managedFields, the last-applied copy of the manifest) are left out.

| Tool | What it returns | Parameters |
|---|---|---|
| `list_pods` | List pods in a namespace with status (as kubectl shows it, for example CrashLoopBackOff or ImagePullBackOff), ready count, phase, restarts, node, and age. | `namespace`, `labelSelector` |
| `get_pod` | Read full detail of one pod (spec, status, conditions, events). | `namespace`, `name` |
| `get_pod_logs` | Read log lines from a pod (tail, previous container, container name, since-time). | `namespace`, `name`, `container`, `tailLines`, `previous`, `sinceSeconds` |
| `list_events` | Recent events in namespace (newest first). | `namespace`, `involvedObject` |
| `list_namespaces` | List all namespaces in the cluster. | none |
| `list_deployments` | List deployments with replicas and status. | `namespace` |
| `get_deployment` | Full deployment spec and status. | `namespace`, `name` |
| `get_rollout_status` | Rollout status of a deployment. | `namespace`, `name` |
| `list_replicasets` | List replicasets. | `namespace` |
| `list_services` | List services with cluster IP and ports. | `namespace` |
| `list_endpoints` | List endpoints (addresses and ports). | `namespace` |
| `list_ingresses` | List ingresses with rules and hosts. | `namespace` |
| `list_nodes` | List nodes with conditions, capacity, and taints. | none |
| `get_node` | Full node detail (conditions, capacity, taints). | `name` |
| `list_pvcs` | List persistent volume claims. | `namespace` |
| `list_jobs` | List jobs. | `namespace` |
| `list_cronjobs` | List cronjobs. | `namespace` |
| `list_hpas` | List horizontal pod autoscalers. | `namespace` |
| `get_pod_metrics` | CPU/memory metrics for a pod (degrades gracefully if metrics-server missing). | `namespace`, `name` |
| `get_node_metrics` | CPU/memory metrics for a node (degrades gracefully). | `name` |
| `diagnose_pod` | Read-only aggregator: status, per-container state and last termination, restarts, recent events (newest first), and the last 50 log lines of the current and previous run. | `namespace`, `name` |

## Notes

- `list_pods` returns `status` (what kubectl shows: CrashLoopBackOff, ImagePullBackOff, Running, ...), `ready`, `phase` and `restarts`. Use `status`, not `phase`, to decide whether a pod is unhealthy.
- `list_namespaces`, `list_nodes`, `get_node` and `get_node_metrics` are cluster-scoped. With the default namespace-only credential they return 403 Forbidden.
- `get_pod_metrics` and `get_node_metrics` need metrics-server in the cluster and report that clearly when it is missing.
- `diagnose_pod` combines status, per-container state and last termination, recent events (newest first) and the last 50 log lines of the current and previous run in one call: a good first step for a single failing pod.
- For restarting containers, call `get_pod_logs` with `previous` set to true to see why the last run died.
