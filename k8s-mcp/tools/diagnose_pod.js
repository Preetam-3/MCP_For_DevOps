import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";
import { redact } from "../lib/redact.js";
import { formatError } from "../lib/errors.js";
import { podStatus, readyCount, containerSummaries, pickContainer } from "../lib/pod-status.js";

export const config = {
  name: "diagnose_pod",
  annotations: { title: "Diagnose pod", description: "Read-only aggregator: status, per-container state and last termination, restarts, recent events (newest first), and the last 50 log lines of the current and previous run.", readOnlyHint: true },
  inputSchema: { namespace: z.string(), name: z.string() },
};

export async function handler({ namespace, name }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);

  // Only a real 404 means "not found"; any other error (403, unreachable cluster) must surface.
  let pod;
  try {
    pod = await core.readNamespacedPod({ namespace, name });
  } catch (err) {
    if (err?.code === 404) return { content: [{ type: "text", text: `Pod ${name} not found in namespace ${namespace}.` }] };
    throw err;
  }

  const container = pickContainer(pod);
  const readLog = (previous) => core.readNamespacedPodLog({ namespace, name, container, tailLines: 50, previous })
    .then((t) => redact(String(t).trim()) || "(empty)")
    .catch((e) => `(not available: ${formatError(e)})`);
  const [eventsRes, current, previous] = await Promise.all([
    core.listNamespacedEvent({ namespace, fieldSelector: `involvedObject.name=${name}` }).catch(() => ({ items: [] })),
    readLog(false),
    (pod.status?.containerStatuses ?? []).some((c) => (c.restartCount ?? 0) > 0) ? readLog(true) : Promise.resolve(null),
  ]);

  const when = (e) => new Date(e.lastTimestamp || e.eventTime || e.metadata?.creationTimestamp || 0).getTime();
  const events = [...(eventsRes.items || [])].sort((a, b) => when(b) - when(a)).slice(0, 8)
    .map((e) => `  ${e.type}/${e.reason}: ${e.message} (${e.count ?? 1}x)`);
  const containers = containerSummaries(pod)
    .map((c) => `  ${c.container}: ${c.state}${c.lastRun ? `; last run: ${c.lastRun}` : ""}; restarts: ${c.restarts}; ready: ${c.ready}`);
  const restarts = (pod.status?.containerStatuses ?? []).reduce((n, c) => n + (c.restartCount ?? 0), 0);

  const summary = `
=== DIAGNOSIS: ${name} (${namespace}) ===
Status: ${podStatus(pod)}   (phase: ${pod.status?.phase || "Unknown"}, ready ${readyCount(pod)})
Restarts (total): ${restarts}
Node: ${pod.spec?.nodeName || "Unknown"}

--- Containers ---
${containers.join("\n") || "  (none reported)"}

--- Recent events (newest first) ---
${events.join("\n") || "  (none)"}

--- Last 50 log lines, current run (container: ${container}) ---
${current}
${previous !== null ? `\n--- Last 50 log lines, previous run (container: ${container}) ---\n${previous}\n` : ""}`;
  return { content: [{ type: "text", text: capText(summary) }] };
}
