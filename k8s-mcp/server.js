#!/usr/bin/env node
// Read-only Kubernetes MCP server.
// It exposes get/list/diagnose/read-only tools ONLY.
// There is deliberately no mutating tool (create/delete/patch/replace/exec/scale/apply/evict/restart/update).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const log = (...args) => console.error("[k8s-mcp]", ...args);

const server = new McpServer({ name: "k8s-readonly", version: "1.0.0" });

function formatError(err) {
  // Never expose raw stack traces to the agent
  const msg = err?.message || String(err);
  if (msg.includes("403") || msg.includes("Forbidden")) {
    return "403 Forbidden: this credential is read-only by design. Kubernetes RBAC denied the request.";
  }
  if (msg.includes("not allowed") || msg.includes("NAMESPACE_ALLOWLIST")) {
    return msg;
  }
  return `Read-only error: ${msg}`;
}

// Import and register all read-only tools
import { config as listPodsCfg, handler as listPodsHandler } from "./tools/list_pods.js";
import { config as getPodCfg, handler as getPodHandler } from "./tools/get_pod.js";
import { config as getPodLogsCfg, handler as getPodLogsHandler } from "./tools/get_pod_logs.js";
import { config as listEventsCfg, handler as listEventsHandler } from "./tools/list_events.js";
import { config as listNamespacesCfg, handler as listNamespacesHandler } from "./tools/list_namespaces.js";
import { config as listDeploymentsCfg, handler as listDeploymentsHandler } from "./tools/list_deployments.js";
import { config as getDeploymentCfg, handler as getDeploymentHandler } from "./tools/get_deployment.js";
import { config as getRolloutStatusCfg, handler as getRolloutStatusHandler } from "./tools/get_rollout_status.js";
import { config as listReplicaSetsCfg, handler as listReplicaSetsHandler } from "./tools/list_replicasets.js";
import { config as listServicesCfg, handler as listServicesHandler } from "./tools/list_services.js";
import { config as listEndpointsCfg, handler as listEndpointsHandler } from "./tools/list_endpoints.js";
import { config as listIngressesCfg, handler as listIngressesHandler } from "./tools/list_ingresses.js";
import { config as listNodesCfg, handler as listNodesHandler } from "./tools/list_nodes.js";
import { config as getNodeCfg, handler as getNodeHandler } from "./tools/get_node.js";
import { config as listPvcsCfg, handler as listPvcsHandler } from "./tools/list_pvcs.js";
import { config as listJobsCfg, handler as listJobsHandler } from "./tools/list_jobs.js";
import { config as listCronjobsCfg, handler as listCronjobsHandler } from "./tools/list_cronjobs.js";
import { config as listHpasCfg, handler as listHpasHandler } from "./tools/list_hpas.js";
import { config as getPodMetricsCfg, handler as getPodMetricsHandler } from "./tools/get_pod_metrics.js";
import { config as getNodeMetricsCfg, handler as getNodeMetricsHandler } from "./tools/get_node_metrics.js";
import { config as diagnosePodCfg, handler as diagnosePodHandler } from "./tools/diagnose_pod.js";

function reg(name, cfg, handler) {
  server.registerTool(name, {
    title: cfg.annotations.title,
    description: cfg.annotations.description,
    annotations: { ...cfg.annotations },
    inputSchema: cfg.inputSchema,
  }, async (args, extra) => {
    try {
      return await handler(args);
    } catch (err) {
      log("error in", name, ":", err.message || err);
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  });
}

reg("list_pods", listPodsCfg, listPodsHandler);
reg("get_pod", getPodCfg, getPodHandler);
reg("get_pod_logs", getPodLogsCfg, getPodLogsHandler);
reg("list_events", listEventsCfg, listEventsHandler);
reg("list_namespaces", listNamespacesCfg, listNamespacesHandler);
reg("list_deployments", listDeploymentsCfg, listDeploymentsHandler);
reg("get_deployment", getDeploymentCfg, getDeploymentHandler);
reg("get_rollout_status", getRolloutStatusCfg, getRolloutStatusHandler);
reg("list_replicasets", listReplicaSetsCfg, listReplicaSetsHandler);
reg("list_services", listServicesCfg, listServicesHandler);
reg("list_endpoints", listEndpointsCfg, listEndpointsHandler);
reg("list_ingresses", listIngressesCfg, listIngressesHandler);
reg("list_nodes", listNodesCfg, listNodesHandler);
reg("get_node", getNodeCfg, getNodeHandler);
reg("list_pvcs", listPvcsCfg, listPvcsHandler);
reg("list_jobs", listJobsCfg, listJobsHandler);
reg("list_cronjobs", listCronjobsCfg, listCronjobsHandler);
reg("list_hpas", listHpasCfg, listHpasHandler);
reg("get_pod_metrics", getPodMetricsCfg, getPodMetricsHandler);
reg("get_node_metrics", getNodeMetricsCfg, getNodeMetricsHandler);
reg("diagnose_pod", diagnosePodCfg, diagnosePodHandler);

// Register prompts
import { prompts } from "./prompts/index.js";
for (const p of prompts) {
  if (typeof server.registerPrompt === "function") {
    server.registerPrompt(p.name, { messages: p.messages });
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
log("read-only Kubernetes MCP server started (tools: 21, prompts: 4) — all readOnlyHint: true, no mutating APIs exposed");
