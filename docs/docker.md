# Running with Docker

Build the image from the repository root:

```bash
docker build -t k8s-readonly-mcp .
```

Mount the scoped kubeconfig (read-only) and point `KUBECONFIG` at it. `-i` keeps stdin open, which the MCP stdio transport needs:

```bash
docker run -i --rm \
  -v "$(pwd)/mcp.kubeconfig:/kube/config:ro" \
  -e KUBECONFIG=/kube/config \
  k8s-readonly-mcp
```

Agent config (for example Claude Code):

```bash
claude mcp add k8s-readonly -- docker run -i --rm \
  -v "$(pwd)/mcp.kubeconfig:/kube/config:ro" -e KUBECONFIG=/kube/config k8s-readonly-mcp
```

**Network note:** the API server address inside `mcp.kubeconfig` must be reachable from inside the container. A local `kind` or `k3s` cluster usually listens on `127.0.0.1`, which does not work from a container; on Linux add `--network host`. The `npx` install avoids this problem.

The image runs as the unprivileged `node` user and listens on no port.
