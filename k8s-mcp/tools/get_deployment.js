import { z } from "zod";
import { KubeConfig, AppsV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";
import { sanitizeObject } from "../lib/redact.js";

export const config = {
  name: "get_deployment",
  annotations: { title: "Get deployment", description: "Full deployment spec and status.", readOnlyHint: true },
  inputSchema: { namespace: z.string(), name: z.string() },
};

export async function handler({ namespace, name }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const apps = kc.makeApiClient(AppsV1Api);
  const d = await apps.readNamespacedDeployment({ namespace, name });
  return { content: [{ type: "text", text: capText(JSON.stringify(sanitizeObject(d), null, 2)) }] };
}
