import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_pvcs",
  annotations: { title: "List PVCs", description: "List persistent volume claims.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNamespacedPersistentVolumeClaim({ namespace });
  const items = res.items.map(p => ({ name: p.metadata?.name, status: p.status?.phase, capacity: p.status?.capacity?.storage }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
