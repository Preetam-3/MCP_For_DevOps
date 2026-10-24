// Imported by server.js before anything talks to Kubernetes.
import { credentialProblem, credentialWarning } from "./credential.js";

const problem = credentialProblem();
if (problem) {
  console.error(problem);
  process.exit(1);
}
const warning = credentialWarning();
if (warning) console.error(`[k8s-mcp] ${warning}`);
