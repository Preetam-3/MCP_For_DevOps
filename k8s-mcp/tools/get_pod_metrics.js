import { z } from "zod";
import { KubeConfig, Metrics } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "get_pod_metrics",
  annotations: { title: "Get pod metrics", description: "CPU/memory metrics for a pod (degrades gracefully if metrics-server missing).", readOnlyHint: true },
  inputSchema: { namespace: z.string(), name: z.string() },
};

export async function handler({ namespace, name }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const metrics = new Metrics(kc);
  try {
    const res = await metrics.getPodMetrics(namespace, name);
    const pods = res.items || [];
    return { content: [{ type: "text", text: capText(JSON.stringify(pods.map(p => ({ podName: p.metadata?.name, containers: p.containers?.map(c => ({ name: c.name, usage: c.usage })) })), null, 2)) }] };
  } catch (e) {
    return { content: [{ type: "text", text: "Metrics not available: metrics-server may be missing or unreachable. Ensure metrics-server is installed (e.g., `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`)." }] };
  }
}
