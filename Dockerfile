FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Non-root user; read-only filesystem where possible
USER appuser
COPY --chown=appuser:appgroup k8s-mcp/package.json k8s-mcp/package-lock.json ./
COPY --chown=appuser:appgroup k8s-mcp/ ./
RUN npm ci --omit=dev && npm cache clean --force
EXPOSE 3000
ENV NODE_ENV=production
ENV KUBECONFIG=/tmp/scoped/kubeconfig
ENTRYPOINT ["node", "server.js"]
CMD []
