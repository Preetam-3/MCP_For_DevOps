# Read-only Kubernetes MCP server image (stdio transport, no network port).
FROM node:20-alpine
WORKDIR /app

# Install production dependencies first so this layer is cached.
COPY k8s-mcp/package.json k8s-mcp/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# One COPY per folder: a multi-source COPY would flatten the directories.
COPY k8s-mcp/server.js ./
COPY k8s-mcp/lib ./lib
COPY k8s-mcp/tools ./tools
COPY k8s-mcp/prompts ./prompts
COPY k8s-mcp/scripts ./scripts

ENV NODE_ENV=production
# The official node image already provides an unprivileged "node" user.
USER node
# Mount your scoped kubeconfig and set KUBECONFIG at run time (see docs/docker.md).
ENTRYPOINT ["node", "server.js"]
