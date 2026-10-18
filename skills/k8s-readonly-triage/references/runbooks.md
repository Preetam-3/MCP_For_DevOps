# Runbooks: symptom to likely cause

Contents: CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending, Failed rollout, Probe failures, No endpoints, Node NotReady

Each section lists what to check with read-only tools, common causes, and the fix the *human* should run.

## CrashLoopBackOff
**Check:** `get_pod` (lastState.terminated: reason, exitCode), previous-container logs via `get_pod_logs`, `list_events`.
**Common causes:**
- Exit code 1 with an application error in logs: bad config, missing env var, failed dependency connection.
- Exit code 137: killed (see OOMKilled).
- Exit code 127/126: wrong command or entrypoint in the image.
- Process exits immediately by design (a one-shot command run as a long-lived container).
**Fix (human):** correct the config/env/command in the Deployment manifest, then `kubectl rollout restart deployment/<name> -n <ns>`.

## OOMKilled
**Check:** lastState.terminated.reason = OOMKilled, container memory limit, `get_pod_metrics` if available.
**Causes:** limit too low for real usage, memory leak, a traffic spike.
**Fix (human):** raise `resources.limits.memory` (and requests) in the manifest, or fix the leak. Note: raising limits can cause node pressure if the node is already tight.

## ImagePullBackOff / ErrImagePull
**Check:** `list_events` for the pull error message, image name and tag in `get_pod`.
**Causes:** typo in image or tag, tag does not exist, private registry without an imagePullSecret, registry rate limit or network issue.
**Fix (human):** correct the image reference, or create/attach the pull secret (`kubectl create secret docker-registry ...` and reference it in the pod spec). This agent cannot read secrets.

## Pending / Unschedulable
**Check:** events with `FailedScheduling`, pod resource requests, `list_nodes` capacity, taints, nodeSelector/affinity, `list_pvcs` (unbound claims).
**Causes:** not enough CPU/memory on any node, taints without tolerations, selector matches no node, PVC not bound, quota exceeded.
**Fix (human):** lower requests, add node capacity, add a toleration, fix the selector, or provision the volume.

## Failed or stuck rollout
**Check:** `get_rollout_status`, `list_replicasets` (new vs old), pods of the new ReplicaSet, events.
**Causes:** new pods fail to start or fail readiness, so the rollout never completes; `progressDeadlineSeconds` exceeded; insufficient capacity.
**Fix (human):** fix the cause shown by the new pods; to go back, `kubectl rollout undo deployment/<name> -n <ns>` (disruptive: say so).

## Readiness / liveness probe failures
**Check:** probe config in `get_pod` (path, port, timings), events (`Unhealthy`), app logs around startup.
**Causes:** wrong port or path, app slower to start than `initialDelaySeconds`, liveness probe too aggressive, dependency down.
**Fix (human):** correct the probe, add a `startupProbe`, or increase delays and thresholds.

## Service has no endpoints
**Check:** `list_services` selector, `list_endpoints`, pod labels and readiness.
**Causes:** selector does not match pod labels, pods not Ready, wrong targetPort.
**Fix (human):** align labels and selector, or fix readiness first.

## Node NotReady / pressure
**Check:** `get_node` conditions (Ready, MemoryPressure, DiskPressure, PIDPressure), events on the node, pods scheduled there.
**Causes:** kubelet down, disk full, memory exhaustion, network problem.
**Fix (human):** needs node-level access (cordon/drain, free disk, restart kubelet). Say clearly that this is outside what a read-only agent can see or do.
