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

# Build extension
RUN npm run compile

# Build VSIX package
RUN vsce package --no-dependencies -o extension.vsix

# Install extension into code-server
RUN code-server --install-extension extension.vsix

# Pre-configure settings to disable trust dialog and welcome
RUN mkdir -p /home/coder/.local/share/code-server/User && \
    echo '{"security.workspace.trust.enabled": false, "security.workspace.trust.startupPrompt": "never", "workbench.startupEditor": "none", "workbench.tips.enabled": false, "workbench.welcomePage.walkthroughs.openOnInstall": false}' > /home/coder/.local/share/code-server/User/settings.json

# Generate self-signed certificate for HTTPS (required for webviews)
USER root
RUN mkdir -p /etc/code-server/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/code-server/certs/key.pem \
    -out /etc/code-server/certs/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Org/CN=localhost" && \
    chown -R coder:coder /etc/code-server
USER coder

# Expose code-server port
EXPOSE 8080

# Health check (use -k for self-signed cert)
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s \
    CMD curl -fk https://localhost:8080/healthz || exit 1

# Start code-server with HTTPS for webview support
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "--cert", "/etc/code-server/certs/cert.pem", "--cert-key", "/etc/code-server/certs/key.pem", "/home/coder/extension"]
