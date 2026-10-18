import { z } from "zod";
import { KubeConfig, AppsV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_replicasets",
  annotations: { title: "List replicasets", description: "List replicasets.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const apps = kc.makeApiClient(AppsV1Api);
  const res = await apps.listNamespacedReplicaSet({ namespace });
  const items = res.items.map(rs => ({ name: rs.metadata?.name, replicas: rs.spec?.replicas, ready: rs.status?.readyReplicas }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
