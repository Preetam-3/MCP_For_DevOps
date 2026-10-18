# Sample investigation

**User:** "My app in the demo namespace keeps restarting, can you see why and fix it?"

**Agent actions (all read-only):** list_pods (demo) -> found `crasher` in CrashLoopBackOff, 14 restarts -> list_events -> back-off restarting failed container -> get_pod -> last termination exit code 1 -> get_pod_logs (previous container) -> shows `starting` then immediate exit.

**Report:**

**Symptom:** pod `crasher` in namespace `demo` restarts continuously.
**Evidence:**
- list_pods: status CrashLoopBackOff, 14 restarts.
- get_pod: last terminated state, reason Error, exit code 1.
- get_pod_logs (previous): prints "starting" and the process exits about 2 seconds later.
**Most likely root cause:** the container's command exits with code 1 by design (it is a script that always fails), so Kubernetes keeps restarting it. Confidence: high.
**Fix (for you to run):** correct the container command in the manifest so it runs a long-lived process, then `kubectl apply -f <manifest>`. I cannot restart or edit it myself because this agent is read-only.
**Verify:** `kubectl get pods -n demo -w` should show the pod Running with restarts no longer increasing.
