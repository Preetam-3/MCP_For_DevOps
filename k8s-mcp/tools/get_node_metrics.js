import { z } from "zod";
import { KubeConfig, Metrics } from "@kubernetes/client-node";
import { capText } from "../lib/limits.js";

export const config = {
  name: "get_node_metrics",
  annotations: { title: "Get node metrics", description: "CPU/memory metrics for a node (degrades gracefully).", readOnlyHint: true },
  inputSchema: { name: z.string() },
};

export async function handler({ name }) {
  const kc = new KubeConfig(); kc.loadFromDefault();
  const metrics = new Metrics(kc);
  try {
    const res = await metrics.getNodeMetrics(name);
    return { content: [{ type: "text", text: capText(JSON.stringify(res, null, 2)) }] };
  } catch (e) {
    return { content: [{ type: "text", text: "Metrics not available: metrics-server may be missing or unreachable." }] };
  }
}
