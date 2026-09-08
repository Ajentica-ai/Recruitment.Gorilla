import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Read-only E2E smoke against the already-running dev stack (client :5173 → proxy → API :5000 → MySQL).
// Start the app first (npm run dev + the API), then: npm run e2e
//
// Credentials come from `e2e/.env.e2e`, which is gitignored — copy
// `e2e/.env.e2e.example` and fill it in. Environment variables still win, so CI
// can inject secrets without a file. Parsed here rather than via a dotenv
// dependency: it is a dozen lines and avoids adding a package for one file.
function loadEnvFile(path: string): void {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return; // No file is fine — the spec self-skips when the vars are absent.
  }
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Strip one layer of matching quotes so a password containing '#' or
    // spaces survives.
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    // Don't clobber a real environment variable — CI should always win.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(new URL('./e2e/.env.e2e', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
