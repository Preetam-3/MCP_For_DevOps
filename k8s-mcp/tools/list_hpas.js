import { z } from "zod";
import { KubeConfig, AutoscalingV2Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_hpas",
  annotations: { title: "List HPAs", description: "List horizontal pod autoscalers.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const autoscale = kc.makeApiClient(AutoscalingV2Api);
  try {
    const res = await autoscale.listNamespacedHorizontalPodAutoscaler({ namespace });
    const items = res.items.map(h => ({ name: h.metadata?.name, current: h.status?.currentMetrics?.map(m => `${m.type}=${m.resource?.current?.averageValue}`), target: h.spec?.minReplicas, max: h.spec?.maxReplicas }));
    return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
  } catch (e) {
    if (e.status === 404 || (e.body && e.body.message && e.body.message.includes("not found"))) {
      return { content: [{ type: "text", text: "No metrics-server or HPA API not available; no HPA data found." }] };
    }
    throw e;
  }
}
