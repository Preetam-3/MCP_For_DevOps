const DEFAULT_MAX_LINES = 200;
const DEFAULT_MAX_BYTES = 50 * 1024;

export function capText(text, maxLines = DEFAULT_MAX_LINES, maxBytes = DEFAULT_MAX_BYTES) {
  if (typeof text !== "string") text = String(text);
  const lines = text.split("\n");
  let truncated = false;
  let result = lines;
  if (lines.length > maxLines) {
    truncated = true;
    result = lines.slice(0, maxLines);
  }
  let joined = result.join("\n");
  if (Buffer.byteLength(joined, "utf8") > maxBytes) {
    truncated = true;
    joined = joined.slice(0, maxBytes);
  }
  if (truncated) {
    joined += `\n\n[TRUNCATED — exceeded ${maxLines} lines or ${maxBytes} bytes]`;
  }
  return joined;
}
