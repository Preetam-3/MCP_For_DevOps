import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { redact } from "../lib/redact.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "get_pod_logs",
  annotations: {
    title: "Get pod logs",
    description: "Read log lines from a pod (tail, previous container, container name, since-time).",
    readOnlyHint: true,
  },
  inputSchema: {
    namespace: z.string(),
    name: z.string(),
    container: z.string().optional(),
    tailLines: z.number().optional().default(50),
    previous: z.boolean().optional(),
    sinceSeconds: z.number().optional(),
  },
};

export async function handler({ namespace, name, container, tailLines = 50, previous, sinceSeconds }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const opts = { namespace, name, container, tailLines };
  if (previous) opts.previous = true;
  if (sinceSeconds) opts.sinceSeconds = sinceSeconds;
  const logs = await core.readNamespacedPodLog(opts);
  const redacted = redact(logs || "(no log output)");
  return { content: [{ type: "text", text: capText(redacted, 200, 50 * 1024) }] };
}
