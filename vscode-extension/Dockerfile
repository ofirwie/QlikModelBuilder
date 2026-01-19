# VS Code Server for automated extension testing
FROM codercom/code-server:latest

USER root

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# Install Playwright dependencies
RUN npx playwright install-deps chromium

# Install vsce globally (as root)
RUN npm install -g @vscode/vsce

USER coder

# Set working directory
WORKDIR /home/coder/extension

# Copy package files first for better caching
COPY --chown=coder:coder package*.json ./

# Install dependencies
RUN npm ci

# Copy extension source
COPY --chown=coder:coder . .

# Build extension with esbuild (bundles all dependencies)
RUN npm run esbuild

# Build VSIX package (dependencies are bundled, so no need for node_modules)
RUN vsce package --allow-star-activation --no-dependencies -o extension.vsix

# Install extension into code-server
RUN code-server --install-extension extension.vsix

# Pre-configure settings to disable trust dialog and welcome
RUN mkdir -p /home/coder/.local/share/code-server/User && \
    echo '{"security.workspace.trust.enabled": false, "security.workspace.trust.startupPrompt": "never", "workbench.startupEditor": "none", "workbench.tips.enabled": false, "workbench.welcomePage.walkthroughs.openOnInstall": false}' > /home/coder/.local/share/code-server/User/settings.json

# Expose code-server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s \
    CMD curl -f http://localhost:8080/healthz || exit 1

# Start code-server WITHOUT HTTPS (HTTP only for localhost)
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/extension"]
