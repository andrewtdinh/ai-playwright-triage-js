import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    slowMo: 100, // slow down actions by 100ms to better observe test execution
  },
  reporter: [
    ['list'],                         // nice terminal output
    ['json', { outputFile: 'playwright-report.json' }], // JSON for the AI analyzer
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
