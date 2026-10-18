import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_nodes",
  annotations: { title: "List nodes", description: "List nodes with conditions, capacity, and taints.", readOnlyHint: true },
  inputSchema: {},
};

export async function handler() {
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNode();
  const items = res.items.map(n => ({ name: n.metadata?.name, conditions: n.status?.conditions?.map(c => `${c.type}=${c.status}`), capacity: n.status?.capacity, taints: n.spec?.taints?.map(t => `${t.key}:${t.effect}`) }));
  return { content: [{ type: "text", text: capText(JSON.stringify(items, null, 2)) }] };
}
