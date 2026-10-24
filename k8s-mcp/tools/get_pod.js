import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";
import { sanitizeObject } from "../lib/redact.js";

export const config = {
  name: "get_pod",
  annotations: {
    title: "Get pod",
    description: "Read full detail of one pod (spec, status, conditions, events).",
    readOnlyHint: true,
  },
  inputSchema: {
    namespace: z.string(),
    name: z.string(),
  },
};

export async function handler({ namespace, name }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const pod = await core.readNamespacedPod({ namespace, name });
  return { content: [{ type: "text", text: capText(JSON.stringify(sanitizeObject(pod), null, 2)) }] };
}
