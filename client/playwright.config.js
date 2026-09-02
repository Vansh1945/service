import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Multi-Browser & Multi-Device Test Matrix Configuration
 * Covers: Chrome, Firefox, Edge, Safari (WebKit), Mobile Android, Mobile iPhone, Tablet, Desktop
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // --- Desktop Browsers ---
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Desktop Safari (WebKit)',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Desktop Edge',
      use: { ...devices['Desktop Edge'] },
    },

    // --- Mobile & Tablet Devices ---
    {
      name: 'Mobile Android (Pixel 5)',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile iPhone (Safari iOS)',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'Tablet (iPad Air)',
      use: { ...devices['iPad Air'] },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
