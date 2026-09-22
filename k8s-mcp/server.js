#!/usr/bin/env node
// Read-only Kubernetes MCP server.
// It exposes get/list tools ONLY. There is deliberately no mutating tool here:
// the agent literally has no way to create, patch, or delete anything.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";

// A stdio MCP server speaks JSON-RPC over stdout. Never write logs to stdout or
// you corrupt the protocol stream. All diagnostics go to stderr.
const log = (...args) => console.error("[k8s-mcp]", ...args);

// Loads the kubeconfig pointed to by $KUBECONFIG. We will point that at a
// scoped, read-only ServiceAccount kubeconfig, not your admin credentials.
const kc = new KubeConfig();
kc.loadFromDefault();
const core = kc.makeApiClient(CoreV1Api);

const server = new McpServer({ name: "k8s-readonly", version: "1.0.0" });

server.registerTool(
  "list_pods",
  {
    title: "List pods",
    description: "List pods in a namespace with phase and restart counts.",
    inputSchema: { namespace: z.string().describe("Namespace to list pods in") },
  },
  async ({ namespace }) => {
    const res = await core.listNamespacedPod({ namespace });
    const pods = res.items.map((p) => ({
      name: p.metadata?.name,
      phase: p.status?.phase,
      restarts:
        p.status?.containerStatuses?.reduce(
          (n, c) => n + (c.restartCount ?? 0),
          0
        ) ?? 0,
    }));
    return { content: [{ type: "text", text: JSON.stringify(pods, null, 2) }] };
  }
);

server.registerTool(
  "get_pod",
  {
    title: "Get pod",
    description: "Read one pod's spec and status (like kubectl describe, read-only).",
    inputSchema: {
      namespace: z.string().describe("Namespace the pod is in"),
      name: z.string().describe("Pod name"),
    },
  },
  async ({ namespace, name }) => {
    const pod = await core.readNamespacedPod({ name, namespace });
    return { content: [{ type: "text", text: JSON.stringify(pod, null, 2) }] };
  }
);

server.registerTool(
  "pod_logs",
  {
    title: "Pod logs",
    description: "Read recent log lines from a pod (read-only).",
    inputSchema: {
      namespace: z.string().describe("Namespace the pod is in"),
      name: z.string().describe("Pod name"),
      container: z.string().optional().describe("Container name (optional)"),
      tailLines: z.number().optional().describe("How many trailing lines to read"),
    },
  },
  async ({ namespace, name, container, tailLines }) => {
    const logs = await core.readNamespacedPodLog({
      name,
      namespace,
      container,
      tailLines: tailLines ?? 100,
    });
    return { content: [{ type: "text", text: logs || "(no log output)" }] };
  }
);

server.registerTool(
  "list_events",
  {
    title: "List events",
    description: "List recent events in a namespace (read-only).",
    inputSchema: { namespace: z.string().describe("Namespace to read events from") },
  },
  async ({ namespace }) => {
    const res = await core.listNamespacedEvent({ namespace });
    const events = res.items.map((e) => ({
      type: e.type,
      reason: e.reason,
      object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
      message: e.message,
    }));
    return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
log("read-only Kubernetes MCP server started (tools: list_pods, get_pod, pod_logs, list_events)");
