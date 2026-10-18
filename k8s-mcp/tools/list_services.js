import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_services",
  annotations: { title: "List services", description: "List services with cluster IP and ports.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNamespacedService({ namespace });
  const items = res.items.map(s => ({ name: s.metadata?.name, type: s.spec?.type, clusterIP: s.spec?.clusterIP, ports: s.spec?.ports?.map(p => `${p.port}/${p.protocol}`) }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
