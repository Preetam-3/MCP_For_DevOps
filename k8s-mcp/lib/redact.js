const SECRET_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  /bearer [a-zA-Z0-9_-]+/gi,
  /token=[a-zA-Z0-9_-]+/gi,
  /password=[a-zA-Z0-9_-]+/gi,
  /secret=[a-zA-Z0-9_-]+/gi,
  /[a-zA-Z0-9_-]{32,}/g,
];

export function redact(text) {
  if (typeof text !== "string") return text;
  let result = text;
  for (const p of SECRET_PATTERNS) {
    result = result.replace(p, "***REDACTED***");
  }
  return result;
}
