import { z } from "zod";
import { KubeConfig, NetworkingV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_ingresses",
  annotations: { title: "List ingresses", description: "List ingresses with rules and hosts.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const net = kc.makeApiClient(NetworkingV1Api);
  const res = await net.listNamespacedIngress({ namespace });
  const items = res.items.map(i => ({ name: i.metadata?.name, class: i.spec?.ingressClassName, hosts: i.spec?.rules?.map(r => r.host) }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
