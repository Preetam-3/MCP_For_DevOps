import { z } from "zod";
import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { capText } from "../lib/limits.js";
import { sanitizeObject } from "../lib/redact.js";

export const config = {
  name: "get_node",
  annotations: { title: "Get node", description: "Full node detail (conditions, capacity, taints).", readOnlyHint: true },
  inputSchema: { name: z.string() },
};

export async function handler({ name }) {
  const kc = new KubeConfig(); kc.loadFromDefault();
  const core = kc.makeApiClient(CoreV1Api);
  const node = await core.readNode({ name });
  return { content: [{ type: "text", text: capText(JSON.stringify(sanitizeObject(node), null, 2)) }] };
}
