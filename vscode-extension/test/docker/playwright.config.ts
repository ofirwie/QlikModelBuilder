/**
 * Playwright config for Docker GUI tests
 */

import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    baseURL: process.env.VSCODE_URL || 'https://localhost:8080',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--ignore-certificate-errors',
            '--unsafely-treat-insecure-origin-as-secure=https://vscode-test:8080',
            '--disable-web-security',
            '--allow-running-insecure-content',
          ],
        },
      },
    },
  ],
  outputDir: 'test-results/',
};

export default config;
