// Redacts secret-looking strings from text before it is returned to the agent.
// Each entry is [pattern, replacement]. Order matters: specific patterns run first.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "***REDACTED***"],
  [/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, "***REDACTED***"], // JWT
  [/\bbearer\s+[a-zA-Z0-9._~+/=-]+/gi, "***REDACTED***"],
  [/\bbasic\s+[a-zA-Z0-9+/=]{8,}/gi, "***REDACTED***"],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "***REDACTED***"], // AWS access key id
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "***REDACTED***"], // GitHub tokens
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "***REDACTED***"], // API keys of the sk-... form
  // key=value, key: value and "key":"value" forms; the key stays, the value goes
  [/((?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|authorization)["']?\s*[:=]\s*["']?)[^\s"',;&}]+/gi, "$1***REDACTED***"],
];

// Applied to logs only: names are not at risk there, and logs may hold bare tokens.
const OPAQUE_STRING = [/[a-zA-Z0-9_-]{32,}/g, "***REDACTED***"];

// Safe for structured output (resource names and UIDs are kept intact).
export function redactStructured(text) {
  if (typeof text !== "string") return text;
  let result = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) result = result.replace(pattern, replacement);
  return result;
}

export function redact(text) {
  if (typeof text !== "string") return text;
  return redactStructured(text).replace(OPAQUE_STRING[0], OPAQUE_STRING[1]);
}

const SECRET_NAME = /pass(word|wd)?|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|auth/i;
const LAST_APPLIED = "kubectl.kubernetes.io/last-applied-configuration";

// Cleans Kubernetes objects before they are shown: masks secret-looking env values,
// drops the noisy managedFields and the last-applied copy of the whole manifest.
export function sanitizeObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "managedFields") continue;
    if (k === LAST_APPLIED) { out[k] = "[omitted by k8s-readonly-mcp]"; continue; }
    out[k] = sanitizeObject(v);
  }
  if (typeof out.name === "string" && typeof out.value === "string" && SECRET_NAME.test(out.name)) out.value = "***REDACTED***";
  return out;
}
