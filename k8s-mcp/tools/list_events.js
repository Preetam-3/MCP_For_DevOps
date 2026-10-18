import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { checkNamespace } from "../lib/kube.js";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_events",
  annotations: { title: "List events", description: "Recent events in namespace (newest first).", readOnlyHint: true },
  inputSchema: { namespace: z.string(), involvedObject: z.string().optional() },
};

export async function handler({ namespace, involvedObject }) {
  checkNamespace(namespace);
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNamespacedEvent({ namespace });
  let items = res.items || [];
  if (involvedObject) items = items.filter(e => `${e.involvedObject?.kind}/${e.involvedObject?.name}`.includes(involvedObject));
  items.sort((a, b) => new Date(b.lastTimestamp || b.eventTime || 0) - new Date(a.lastTimestamp || a.eventTime || 0));
  const events = items.map(e => ({ type: e.type, reason: e.reason, object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`, message: e.message, count: e.count }));
  return { content: [{ type: "text", text: capText(JSON.stringify(events, null, 2)) }] };
}
