# Sample investigation: pod stuck in Pending

Illustrative output, shown to demonstrate the expected report format.

**User:** "My new pod `report-worker` in the `batch` namespace has been Pending for 20 minutes. Why?"

**Agent actions (all read-only):** list_pods (batch) -> `report-worker-7c9d` Pending, 0 restarts, no node -> list_events (involved object: that pod) -> `FailedScheduling: 0/3 nodes are available: 3 Insufficient memory` -> get_pod -> container requests 8Gi memory -> list_nodes -> largest node allocatable about 6Gi (or, in namespace-only mode, node data returned 403 and was reported as unavailable).

**Report:**

**Symptom:** pod `report-worker-7c9d` in `batch` stays Pending and never starts.
**Evidence:**
- list_events: "0/3 nodes are available: 3 Insufficient memory".
- get_pod: the container requests 8Gi of memory.
- list_nodes: no node has 8Gi allocatable.
**Most likely root cause:** the memory request is larger than any node can provide, so the scheduler cannot place the pod. Confidence: high.
**Fix (for you to run):** lower `resources.requests.memory` in the Deployment (for example to 4Gi) and apply it, or add a larger node. I cannot edit the Deployment myself because this agent is read-only.
**Verify:** `kubectl get pods -n batch -w` should show the pod move to ContainerCreating and then Running.
