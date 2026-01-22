/**
 * Debug test to see what HTML is being rendered
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('debug - show rendered HTML', async ({ page }) => {
  const wizardPanelPath = path.join(__dirname, '../../out/wizardPanel.js');
  const code = fs.readFileSync(wizardPanelPath, 'utf-8');

  // Find the getHtmlForWebview method and extract HTML
  const htmlMatch = code.match(/return\s*`(<!DOCTYPE html>[\s\S]*?)<\/html>`/);
  if (!htmlMatch) {
    throw new Error('Could not extract HTML from wizardPanel.js');
  }

  // Find the getScript function and extract JavaScript
  // The function looks like: function getScript() { return `...`; }
  const scriptStartIdx = code.indexOf('function getScript()');
  if (scriptStartIdx === -1) {
    throw new Error('Could not find getScript function');
  }
  const returnIdx = code.indexOf('return `', scriptStartIdx);
  const scriptStartQuote = code.indexOf('`', returnIdx);
  // Find matching backtick - need to handle nested template literals
  let depth = 1;
  let i = scriptStartQuote + 1;
  while (depth > 0 && i < code.length) {
    if (code[i] === '`' && code[i-1] !== '\\') {
      depth--;
    } else if (code.substring(i, i+2) === '${') {
      // Skip over template expression
      let braceDepth = 1;
      i += 2;
      while (braceDepth > 0 && i < code.length) {
        if (code[i] === '{') braceDepth++;
        if (code[i] === '}') braceDepth--;
        if (code[i] === '`') {
          // Nested template literal
          i++;
          let nestedDepth = 1;
          while (nestedDepth > 0 && i < code.length) {
            if (code[i] === '`' && code[i-1] !== '\\') nestedDepth--;
            i++;
          }
        } else {
          i++;
        }
      }
      continue;
    }
    i++;
  }
  const scriptContent = code.substring(scriptStartQuote + 1, i - 1);
  console.log('Script content length:', scriptContent.length);

  // Get the HTML template
  let html = htmlMatch[1] + '</html>';

  // Replace ${getScript()} with actual script content
  html = html.replace(/\$\{getScript\(\)\}/g, scriptContent);

  // Replace template literals with test values
  const testNonce = 'test-nonce-12345';
  html = html.replace(/\$\{nonce\}/g, testNonce);
  html = html.replace(/\$\{[^}]*nonce[^}]*\}/g, testNonce);
  html = html.replace(/\$\{[^}]+cspSource[^}]*\}/g, "'self'");
  html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
  html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');

  // Fix CSP to allow our test scripts
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/,
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';">'
  );

  // Inject mock vscode API
  const mockVsCodeApi = `
    <script>
      console.log('Mock vscode API loading...');

      // Hook into the message listener to debug
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = function(type, listener, options) {
        if (type === 'message') {
          console.log('Message listener registered!');
          const wrappedListener = function(event) {
            console.log('Message received:', JSON.stringify(event.data));
            return listener.call(this, event);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };

      window.acquireVsCodeApi = function() {
        console.log('acquireVsCodeApi called');
        const api = {
          postMessage: function(msg) {
            console.log('postMessage:', JSON.stringify(msg));
            window.lastMessage = msg;

            // Auto-respond to getInitialData
            if (msg.type === 'getInitialData') {
              console.log('Sending mock initialData in 500ms...');
              setTimeout(() => {
                console.log('Dispatching initialData now...');
                const event = new MessageEvent('message', {
                  data: {
                    type: 'initialData',
                    configured: false,
                    tenantUrl: ''
                  }
                });
                window.dispatchEvent(event);
                console.log('initialData dispatched');
              }, 500);
            }
          },
          getState: function() { return null; },
          setState: function(state) { return state; }
        };
        return api;
      };
      console.log('Mock vscode API ready');
    </script>
  `;
  html = html.replace('</head>', mockVsCodeApi + '</head>');

  // Get console logs BEFORE loading content
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.setContent(html);
  await page.waitForTimeout(2000);

  // Get the actual HTML content of #app
  const appContent = await page.locator('#app').innerHTML();
  console.log('APP CONTENT:', appContent.substring(0, 500));

  // Check if there's any content
  expect(appContent.length).toBeGreaterThan(0);
});
