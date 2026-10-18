import { KubeConfig } from "@kubernetes/client-node";

function getDefaultNamespace() {
  try {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    return kc.getContextObject(kc.currentContext)?.namespace || "default";
  } catch {
    return "default";
  }
}

const ALLOWLIST = (process.env.NAMESPACE_ALLOWLIST || process.env.NAMESPACE || "").split(",").map(s => s.trim()).filter(Boolean);
const DEFAULT_NAMESPACE = ALLOWLIST.length ? null : getDefaultNamespace();

export function checkNamespace(namespace) {
  if (!ALLOWLIST.length && DEFAULT_NAMESPACE && namespace !== DEFAULT_NAMESPACE) {
    throw new Error(`Namespace "${namespace}" is not allowed. Default allowlist (current context namespace): [${DEFAULT_NAMESPACE}]. Set NAMESPACE_ALLOWLIST env var to override.`);
  }
  if (ALLOWLIST.length && !ALLOWLIST.includes(namespace)) {
    throw new Error(`Namespace "${namespace}" is not in NAMESPACE_ALLOWLIST (${ALLOWLIST.join(",")}). Access denied.`);
  }
  return true;
}
