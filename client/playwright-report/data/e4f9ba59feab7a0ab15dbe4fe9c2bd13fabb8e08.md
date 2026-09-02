# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: testing-checklist.spec.js >> Testing Checklist - Multi-Browser & Multi-Device Verification >> 2. Navigation to Login Page
- Location: e2e\testing-checklist.spec.js:19:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/login", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation "Primary navigation" [ref=e3]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - link "Go to homepage" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]:
            - img "Raj Electrical Service"
            - generic [ref=e9]: Raj Electrical Service
        - generic [ref=e11]:
          - link "Home" [ref=e12] [cursor=pointer]:
            - /url: /
          - link "About" [ref=e18] [cursor=pointer]:
            - /url: /about
          - link "Service" [ref=e23] [cursor=pointer]:
            - /url: /services
          - link "Career" [ref=e29] [cursor=pointer]:
            - /url: /careers
          - link "Contact" [ref=e35] [cursor=pointer]:
            - /url: /contact
      - generic [ref=e41]:
        - link "Login" [ref=e42] [cursor=pointer]:
          - /url: /login
        - link "Register" [ref=e49] [cursor=pointer]:
          - /url: /register
  - generic [ref=e58]:
    - generic [ref=e60]:
      - generic [ref=e61]:
        - generic [ref=e62]: Welcome Back to Raj Electrical Service
        - heading "Login to Raj Electrical Service" [level=2] [ref=e67]
        - paragraph [ref=e68]: Access your dashboard, manage bookings, and stay connected with our premium services.
      - generic [ref=e69]:
        - generic [ref=e70]:
          - paragraph [ref=e74]: Instant Access
          - paragraph [ref=e75]: Secure login
        - generic [ref=e76]:
          - paragraph [ref=e80]: Safe & Secure
          - paragraph [ref=e81]: Encrypted data
        - generic [ref=e82]:
          - paragraph [ref=e86]: Real-time Updates
          - paragraph [ref=e87]: Stay notified
        - generic [ref=e88]:
          - paragraph [ref=e92]: Support
          - paragraph [ref=e93]: 24/7 Assistance
      - generic [ref=e94]:
        - heading "Premium Benefits" [level=3] [ref=e95]
        - generic [ref=e99]:
          - generic [ref=e100]: Manage service bookings with one click
          - generic [ref=e105]: Safe & secure payment tracking
          - generic [ref=e110]: Verified professionals at your doorstep
    - generic [ref=e117]:
      - generic [ref=e118]:
        - heading "Sign In" [level=2] [ref=e119]
        - paragraph [ref=e120]: Please enter your credentials to access your account
      - generic [ref=e121]:
        - generic [ref=e122]:
          - generic [ref=e123]: Authentication
          - generic [ref=e128]:
            - generic [ref=e129]:
              - generic [ref=e130]: Email Address
              - textbox "you@example.com" [ref=e132]
            - generic [ref=e133]:
              - generic [ref=e134]: Password
              - generic [ref=e135]:
                - textbox "••••••••" [ref=e136]
                - button [ref=e137] [cursor=pointer]
        - generic [ref=e141]:
          - generic [ref=e142] [cursor=pointer]:
            - checkbox "Remember me" [ref=e143]
            - generic [ref=e144]: Remember me
          - link "Forgot Password?" [ref=e145] [cursor=pointer]:
            - /url: /forgot-password
        - button "Sign In" [ref=e146] [cursor=pointer]
        - generic [ref=e150]: Or Continue With
        - button "Continue with Google" [ref=e153] [cursor=pointer]
      - paragraph [ref=e160]:
        - text: Don't have an account?
        - link "Create an account" [ref=e161] [cursor=pointer]:
          - /url: /register
  - contentinfo [ref=e162]:
    - generic [ref=e164]:
      - generic [ref=e165]:
        - link "Logo Raj Electrical Service" [ref=e166] [cursor=pointer]:
          - /url: /
          - img "Logo" [ref=e167]
          - generic [ref=e168]: Raj Electrical Service
        - paragraph [ref=e169]: Trusted Services at Your Doorstep
        - generic [ref=e170]:
          - link "Follow us on facebook" [ref=e171] [cursor=pointer]:
            - /url: facebook.com
          - link "Follow us on instagram" [ref=e174] [cursor=pointer]:
            - /url: instagram.com
          - link "Follow us on linkedin" [ref=e178] [cursor=pointer]:
            - /url: https://www.linkedin.com/
          - link "Follow us on youtube" [ref=e183] [cursor=pointer]:
            - /url: https://www.youtube.com/
      - generic [ref=e187]:
        - heading "Quick Links" [level=3] [ref=e188]
        - list [ref=e189]:
          - listitem [ref=e190]:
            - link "Home" [ref=e191] [cursor=pointer]:
              - /url: /
          - listitem [ref=e195]:
            - link "Services" [ref=e196] [cursor=pointer]:
              - /url: /services
          - listitem [ref=e200]:
            - link "About Us" [ref=e201] [cursor=pointer]:
              - /url: /about
          - listitem [ref=e205]:
            - link "Contact" [ref=e206] [cursor=pointer]:
              - /url: /contact
          - listitem [ref=e210]:
            - link "Become a Provider" [ref=e211] [cursor=pointer]:
              - /url: /register-provider
      - generic [ref=e215]:
        - heading "Contact Info" [level=3] [ref=e216]
        - list [ref=e217]:
          - listitem [ref=e218]:
            - generic [ref=e222]: Jalandhar , Punjab 144005
          - listitem [ref=e223]:
            - link "8219136254" [ref=e226] [cursor=pointer]:
              - /url: tel:8219136254
          - listitem [ref=e227]:
            - link "rajelectricalservice25@gmail.com" [ref=e231] [cursor=pointer]:
              - /url: mailto:rajelectricalservice25@gmail.com
      - generic [ref=e232]:
        - generic [ref=e233]:
          - heading "Newsletter" [level=3] [ref=e234]
          - generic [ref=e235]:
            - textbox "Enter your email" [ref=e236]
            - button [ref=e237] [cursor=pointer]
        - generic [ref=e241]:
          - heading "Download Our App" [level=3] [ref=e242]
          - button "Launch Web App" [ref=e243] [cursor=pointer]
    - generic [ref=e250]:
      - paragraph [ref=e251]: © 2026 Raj Electrical Service. All rights reserved.
      - generic [ref=e252]:
        - link "Terms & Conditions" [ref=e253] [cursor=pointer]:
          - /url: /terms-and-conditions
        - link "Privacy Policy" [ref=e254] [cursor=pointer]:
          - /url: /privacy-policy
        - link "Refund Policy" [ref=e255] [cursor=pointer]:
          - /url: /refund-policy
      - paragraph [ref=e256]:
        - text: Made with by
        - link "Vansh" [ref=e259] [cursor=pointer]:
          - /url: https://vanshkholi0.vercel.app/
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
> 20 |     await page.goto('/login');
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  21 |     await expect(page.locator('input[type="email"], input[name="email"], input[name="loginIdentifier"]')).toBeVisible({ timeout: 5000 }).catch(() => {
  22 |       // Fallback assertion on login container if input is custom styled
  23 |       expect(page.url()).toContain('/login');
  24 |     });
  25 |   });
  26 | 
  27 |   test('3. Navigation to Registration (Signup) Page', async ({ page }) => {
  28 |     await page.goto('/register');
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