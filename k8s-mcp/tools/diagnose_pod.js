import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "diagnose_pod",
  annotations: { title: "Diagnose pod", description: "Read-only aggregator: status, termination reason, restarts, recent events, last 50 log lines.", readOnlyHint: true },
  inputSchema: { namespace: z.string(), name: z.string() },
};

export async function handler({ namespace, name }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const [pod, eventsRes, logs] = await Promise.all([
    core.readNamespacedPod({ namespace, name }).catch(() => null),
    core.listNamespacedEvent({ namespace, fieldSelector: `involvedObject.name=${name}` }).catch(() => ({ items: [] })),
    core.readNamespacedPodLog({ namespace, name, tailLines: 50, container: undefined }).catch(() => "(log read failed)"),
  ]);
  if (!pod) return { content: [{ type: "text", text: `Pod ${name} not found in namespace ${namespace}.` }] };
  const lastTermination = pod.status?.containerStatuses?.map(c => ({ container: c.name, state: c.state?.terminated?.reason || "none", exitCode: c.state?.terminated?.exitCode })) || [];
  const restarts = pod.status?.containerStatuses?.reduce((n, c) => n + (c.restartCount ?? 0), 0) ?? 0;
  const recentEvents = (eventsRes.items || []).slice(0, 5).map(e => `  ${e.type}/${e.reason}: ${e.message} (${e.count}x)`);
  const summary = `
=== DIAGNOSIS: ${name} (${namespace}) ===
Phase: ${pod.status?.phase || "Unknown"}
Restarts (total): ${restarts}
Node: ${pod.spec?.nodeName || "Unknown"}

--- Last termination reasons ---
${lastTermination.map(t => `  ${t.container}: ${t.state} (exit ${t.exitCode})`).join("\n") || "  (none)"}

--- Recent events ---
${recentEvents.join("\n") || "  (none)"}

--- Last 50 log lines ---
${logs}
`;
  return { content: [{ type: "text", text: capText(summary) }] };
}
