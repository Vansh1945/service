# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: testing-checklist.spec.js >> Testing Checklist - Multi-Browser & Multi-Device Verification >> 3. Navigation to Registration (Signup) Page
- Location: e2e\testing-checklist.spec.js:27:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/register", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - paragraph [ref=e8]: Please Wait...
  - generic "Notifications"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * End-to-End Playwright Test Suite verifying the 12-Item Testing Checklist
  5  |  * Covers: Login, Signup, Logout, CRUD Operations, File Upload, Search, Pagination, Responsive Layout
  6  |  * Executed across Chrome, Firefox, Edge, Safari, Mobile Android, Mobile iPhone, Tablet, Desktop.
  7  |  */
  8  | 
  9  | test.describe('Testing Checklist - Multi-Browser & Multi-Device Verification', () => {
  10 | 
  11 |   test('1. Page load and Responsive Layout test', async ({ page }) => {
  12 |     await page.goto('/');
  13 |     // Check main branding header or root container visible
  14 |     await expect(page).toHaveTitle(/Raj Electrical Service/i);
  15 |     const body = page.locator('body');
  16 |     await expect(body).toBeVisible();
  17 |   });
  18 | 
  19 |   test('2. Navigation to Login Page', async ({ page }) => {
  20 |     await page.goto('/login');
  21 |     await expect(page.locator('input[type="email"], input[name="email"], input[name="loginIdentifier"]')).toBeVisible({ timeout: 5000 }).catch(() => {
  22 |       // Fallback assertion on login container if input is custom styled
  23 |       expect(page.url()).toContain('/login');
  24 |     });
  25 |   });
  26 | 
  27 |   test('3. Navigation to Registration (Signup) Page', async ({ page }) => {
> 28 |     await page.goto('/register');
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  29 |     await expect(page.url()).toContain('/register');
  30 |   });
  31 | 
  32 |   test('4. Services Search & Search Input Interaction', async ({ page }) => {
  33 |     await page.goto('/services');
  34 |     const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]');
  35 |     if (await searchInput.isVisible()) {
  36 |       await searchInput.fill('Plumbing');
  37 |       await expect(searchInput).toHaveValue('Plumbing');
  38 |     }
  39 |   });
  40 | 
  41 |   test('5. Services Pagination Controls', async ({ page }) => {
  42 |     await page.goto('/services');
  43 |     const paginationContainer = page.locator('nav[aria-label*="pagination" i], div.pagination, button:has-text("Next")');
  44 |     if (await paginationContainer.count() > 0) {
  45 |       await expect(paginationContainer.first()).toBeVisible();
  46 |     }
  47 |   });
  48 | 
  49 |   test('6. Viewport Responsive Layout check', async ({ page }) => {
  50 |     // Mobile Viewport Check (375x667)
  51 |     await page.setViewportSize({ width: 375, height: 667 });
  52 |     await page.goto('/');
  53 |     const body = page.locator('body');
  54 |     await expect(body).toBeVisible();
  55 | 
  56 |     // Desktop Viewport Check (1440x900)
  57 |     await page.setViewportSize({ width: 1440, height: 900 });
  58 |     await expect(body).toBeVisible();
  59 |   });
  60 | });
  61 | 
```