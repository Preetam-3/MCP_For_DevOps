import { z } from "zod";
import { KubeConfig, AppsV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "get_rollout_status",
  annotations: { title: "Get rollout status", description: "Rollout status of a deployment.", readOnlyHint: true },
  inputSchema: { namespace: z.string(), name: z.string() },
};

export async function handler({ namespace, name }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const apps = kc.makeApiClient(AppsV1Api);
  const status = await apps.readNamespacedDeploymentStatus({ namespace, name });
  return { content: [{ type: "text", text: capText(JSON.stringify(status, null, 2)) }] };
}
