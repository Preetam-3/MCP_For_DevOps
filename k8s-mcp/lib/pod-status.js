// Computes the same status kubectl shows (CrashLoopBackOff, ImagePullBackOff, ...),
// because the Kubernetes "phase" alone says only Running or Pending.

export function podStatus(pod) {
  let reason = pod?.status?.reason || pod?.status?.phase || "Unknown";
  const init = pod?.status?.initContainerStatuses ?? [];
  let initializing = false;
  for (let i = 0; i < init.length; i++) {
    const st = init[i];
    if (st.state?.terminated && st.state.terminated.exitCode === 0) continue;
    if (st.state?.terminated) {
      const t = st.state.terminated;
      reason = "Init:" + (t.reason || (t.signal ? `Signal:${t.signal}` : `ExitCode:${t.exitCode}`));
    } else if (st.state?.waiting?.reason && st.state.waiting.reason !== "PodInitializing") {
      reason = "Init:" + st.state.waiting.reason;
    } else {
      reason = `Init:${i}/${init.length}`;
    }
    initializing = true;
    break;
  }
  if (!initializing) {
    const cs = pod?.status?.containerStatuses ?? [];
    for (let i = cs.length - 1; i >= 0; i--) {
      const s = cs[i];
      if (s.state?.waiting?.reason) reason = s.state.waiting.reason;
      else if (s.state?.terminated?.reason) reason = s.state.terminated.reason;
      else if (s.state?.terminated) {
        const t = s.state.terminated;
        reason = t.signal ? `Signal:${t.signal}` : `ExitCode:${t.exitCode}`;
      }
    }
  }
  if (pod?.metadata?.deletionTimestamp) reason = pod.status?.reason === "NodeLost" ? "Unknown" : "Terminating";
  return reason;
}

export function readyCount(pod) {
  const total = pod?.spec?.containers?.length ?? pod?.status?.containerStatuses?.length ?? 0;
  const ready = (pod?.status?.containerStatuses ?? []).filter((c) => c.ready).length;
  return `${ready}/${total}`;
}

export function containerSummaries(pod) {
  return (pod?.status?.containerStatuses ?? []).map((c) => {
    const s = c.state ?? {};
    const state = s.waiting ? `Waiting: ${s.waiting.reason ?? "unknown"}`
      : s.terminated ? `Terminated: ${s.terminated.reason ?? "unknown"} (exit ${s.terminated.exitCode})`
      : s.running ? "Running" : "Unknown";
    const lt = c.lastState?.terminated;
    return { container: c.name, state, lastRun: lt ? `${lt.reason ?? "unknown"} (exit ${lt.exitCode})` : null, restarts: c.restartCount ?? 0, ready: Boolean(c.ready) };
  });
}

// The container most likely to explain a problem: restarting or not ready, else the first non-sidecar.
export function pickContainer(pod) {
  const names = (pod?.spec?.containers ?? []).map((c) => c.name);
  const sums = containerSummaries(pod);
  const bad = sums.find((s) => s.restarts > 0 || !s.ready);
  if (bad) return bad.container;
  return names.find((n) => n !== "istio-proxy" && n !== "linkerd-proxy") ?? names[0];
}
