import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_endpoints",
  annotations: { title: "List endpoints", description: "List endpoints (addresses and ports).", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNamespacedEndpoints({ namespace });
  const items = res.items.map(e => ({ name: e.metadata?.name, subsets: e.subsets?.map(s => ({ addresses: s.addresses?.map(a => a.ip), ports: s.ports?.map(p => `${p.port}/${p.protocol}`) })) }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
