import { z } from "zod";
import { KubeConfig, AppsV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_deployments",
  annotations: { title: "List deployments", description: "List deployments with replicas and status.", readOnlyHint: true },
  inputSchema: { namespace: z.string() },
};

export async function handler({ namespace }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const apps = kc.makeApiClient(AppsV1Api);
  const res = await apps.listNamespacedDeployment({ namespace });
  const items = res.items.map(d => ({ name: d.metadata?.name, replicas: d.spec?.replicas, available: d.status?.availableReplicas, ready: d.status?.readyReplicas }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
