import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { capText } from "../lib/limits.js";

export const config = {
  name: "list_namespaces",
  annotations: { title: "List namespaces", description: "List all namespaces in the cluster.", readOnlyHint: true },
  inputSchema: {},
};

export async function handler() {
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const res = await core.listNamespace();
  const ns = res.items.map(n => ({ name: n.metadata?.name, status: n.status?.phase }));
  return { content: [{ type: "text", text: capText(JSON.stringify(ns, null, 2)) }] };
}
