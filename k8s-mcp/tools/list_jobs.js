import { z } from "zod";
import { KubeConfig, BatchV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_jobs",
  annotations: { title: "List jobs", description: "List jobs.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const batch = kc.makeApiClient(BatchV1Api);
  const res = await batch.listNamespacedJob({ namespace });
  const items = res.items.map(j => ({ name: j.metadata?.name, completions: j.spec?.completions, status: j.status?.succeeded ? `${j.status.succeeded}/${j.spec?.completions}` : "running" }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
