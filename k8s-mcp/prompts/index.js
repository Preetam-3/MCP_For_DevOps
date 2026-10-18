// MCP prompts registered with the server
export const prompts = [
  {
    name: "diagnose-crashloop",
    description: "Investigate a CrashLoopBackOff pod.",
    messages: [
      {
        role: "user",
        content: { type: "text", text: "Diagnose a pod in CrashLoopBackOff. Use diagnose_pod, get_pod, get_pod_logs, and list_events. Return a concise root-cause summary with restart count, termination reason, recent events, and last 30 log lines. Never attempt a fix; explain what's broken only." },
      },
    ],
  },
  {
    name: "why-is-my-pod-pending",
    description: "Find out why a pod is pending.",
    messages: [
      {
        role: "user",
        content: { type: "text", text: "A pod is Pending. Use list_pods, get_pod, and list_events to find scheduling/volume/secret issues. Report the exact reason from events and pod conditions. Never attempt a fix." },
      },
    ],
  },
  {
    name: "rollout-stuck",
    description: "Investigate a stuck rollout.",
    messages: [
      {
        role: "user",
        content: { type: "text", text: "A deployment rollout is stuck. Use list_deployments, get_deployment, get_rollout_status, list_replicasets, and list_events. Report the exact blocker (replicas, readiness, events). Never attempt a fix." },
      },
    ],
  },
  {
    name: "cluster-health-summary",
    description: "Produce a read-only health summary of the cluster.",
    messages: [
      {
        role: "user",
        content: { type: "text", text: "Give a cluster health summary: list_nodes, list_pods (unhealthy/restarts), list_events (errors), get_node_metrics, list_deployments. Report issues only; do not fix anything." },
      },
    ],
  },
];
