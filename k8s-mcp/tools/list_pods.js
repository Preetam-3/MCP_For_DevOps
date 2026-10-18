import { z } from "zod";
import { CoreV1Api } from "@kubernetes/client-node";
import { KubeConfig } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { redact } from "../lib/redact.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_pods",
  annotations: {
    title: "List pods",
    description: "List pods in a namespace with phase, restarts, node, and age.",
    readOnlyHint: true,
  },
  inputSchema: {
    namespace: z.string().describe("Namespace to list pods in"),
    labelSelector: z.string().optional().describe("Label selector filter (e.g. 'app=web')"),
  },
};

export async function handler({ namespace, labelSelector }) {
  checkNamespace(namespace);
  const kc = new KubeConfig();
  kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNamespacedPod({ namespace, labelSelector });
  const pods = res.items.map((p) => ({
    name: p.metadata?.name,
    namespace: p.metadata?.namespace,
    phase: p.status?.phase,
    node: p.spec?.nodeName,
    restarts: p.status?.containerStatuses?.reduce((n, c) => n + (c.restartCount ?? 0), 0) ?? 0,
    ageSeconds: p.metadata?.creationTimestamp ? Math.floor((new Date() - new Date(p.metadata.creationTimestamp)) / 1000) : null,
  }));
  return { content: [{ type: "text", text: capText(JSON.stringify(pods, null, 2)) }] };
}
