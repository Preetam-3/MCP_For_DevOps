import { z } from "zod";
import { KubeConfig, BatchV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_cronjobs",
  annotations: { title: "List cronjobs", description: "List cronjobs.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const batch = kc.makeApiClient(BatchV1Api);
  const res = await batch.listNamespacedCronJob({ namespace });
  const items = res.items.map(c => ({ name: c.metadata?.name, schedule: c.spec?.schedule, active: c.status?.active?.map(a => a.name) }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
