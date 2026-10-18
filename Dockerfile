FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown appuser:appgroup /app
# Non-root user; filesystem is writable by design (kubeconfig writes to /tmp)
USER appuser
COPY --chown=appuser:appgroup k8s-mcp/package.json k8s-mcp/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=appuser:appgroup k8s-mcp/server.js k8s-mcp/lib/ k8s-mcp/tools/ k8s-mcp/prompts/ ./
EXPOSE 3000
ENV NODE_ENV=production
ENV KUBECONFIG=/tmp/scoped/kubeconfig
ENTRYPOINT ["node", "server.js"]
CMD []
