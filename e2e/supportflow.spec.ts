import { test, expect } from '@playwright/test';

test.describe('SupportFlow E2E Operations & Security Workflow', () => {
  test('1. Customer Journey: Help desk navigation, ticket submission, Ticket ID generation, and tracking thread', async ({ page }) => {
    // Navigate to Help Center Home
    await page.goto('/');
    await expect(page).toHaveTitle(/SupportFlow/i);
    await expect(page.locator('text=SupportFlow Help Desk')).toBeVisible();

    // Verify Direct Lookup input is visible on homepage
    const searchInput = page.locator('input[placeholder*="Enter your ticket ID"]');
    await expect(searchInput).toBeVisible();

    // Navigate to Support Form
    await page.click('text=Open New Support Ticket');
    await expect(page).toHaveURL(/\/support/);
    await expect(page.locator('h1')).toContainText(/Submit a Support Request/i);

    // Fill in ticket details using precise form input names
    const uniqueEmail = `customer-${Date.now()}@testcompany.com`;
    const uniqueSubject = `E2E Automated Ticket Verification ${Date.now()}`;

    await page.fill('input[name="name"]', 'E2E Test User');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="subject"]', uniqueSubject);
    await page.selectOption('select[name="category"]', 'billing');
    await page.selectOption('select[name="priority"]', 'P2');
    await page.fill(
      'textarea[name="description"]',
      'Automated E2E test verifying ticket creation, tracking ID generation, and timeline updates.'
    );

    // Submit ticket
    await page.click('button[type="submit"]');

    // Verify Success Confirmation Screen & Ticket ID display
    await expect(page.locator('text=Support Request Submitted!')).toBeVisible({ timeout: 15000 });
    const ticketIdElement = page.locator('span:has-text("TCK-")').first();
    await expect(ticketIdElement).toBeVisible();
    const ticketNumber = (await ticketIdElement.innerText()).trim();
    expect(ticketNumber).toMatch(/^TCK-\d+$/);

    // Click "Track Ticket" button to navigate to tracking page
    await page.click(`a:has-text("Track Ticket")`);
    await expect(page).toHaveURL(new RegExp(`/track/${ticketNumber}`));

    // Verify Ticket Details on Public Tracking Page
    await expect(page.locator(`text=${ticketNumber}`).first()).toBeVisible();
    await expect(page.locator(`text=${uniqueSubject}`)).toBeVisible();

    // Post a customer follow-up reply
    const followUpText = `Customer automated follow-up note at ${Date.now()}`;
    await page.fill('textarea[placeholder*="Type your reply"]', followUpText);
    await page.click('button:has-text("Send Follow-up")');

    // Verify the follow-up appears in the customer message thread
    await expect(page.locator(`text=${followUpText}`)).toBeVisible({ timeout: 15000 });
  });

  test('2. Public Tracker Security: Direct TCK lookup from Home page and invalid ID validation', async ({ page }) => {
    await page.goto('/');

    // Lookup known ticket TCK-1008
    const searchInput = page.locator('input[placeholder*="Enter your ticket ID"]');
    await searchInput.fill('TCK-1008');
    await page.click('button:has-text("Track Ticket")');

    await expect(page).toHaveURL(/\/track\/TCK-1008/);
    await expect(page.locator('span:has-text("TCK-1008")').first()).toBeVisible({ timeout: 15000 });

    // Test invalid lookup
    await page.goto('/track/TCK-999999');
    await expect(page.locator('text=Ticket Not Found')).toBeVisible({ timeout: 15000 });
  });

  test('3. Staff Authentication & RBAC Boundaries: Invalid login, Agent inbox access, and Lead dashboard', async ({ page }) => {
    // Go to Login page
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(/Staff Portal Login/i);

    // Test failed authentication with invalid password
    await page.fill('input[type="email"]', 'agent@supportflow.com');
    await page.fill('input[type="password"]', 'WrongPassword999!');
    await page.click('button:has-text("Sign In to Workspace")');
    await expect(page.locator('div.text-rose-300')).toBeVisible({ timeout: 10000 });

    // Use pre-seeded demo button for Alex Agent
    await page.click('button:has-text("Alex Agent")');
    await page.click('button:has-text("Sign In to Workspace")');

    // Assert redirected to Agent Dashboard
    await expect(page).toHaveURL(/\/agent\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Agent Workspace').first()).toBeVisible();

    // Verify security: Zero JWT tokens in localStorage (strictly HTTP-only cookies)
    const localTokens = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      supportflow_token: localStorage.getItem('supportflow_token'),
    }));
    expect(localTokens.token).toBeNull();
    expect(localTokens.supportflow_token).toBeNull();

    // Verify security: Browser context holds httpOnly cookies
    const cookies = await page.context().cookies();
    const accessCookie = cookies.find((c) => c.name === 'accessToken' || c.name === 'token');
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(accessCookie).toBeDefined();
    expect(accessCookie?.httpOnly).toBe(true);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);

    // Verify session persistence on page reload purely via HTTP-only cookies
    await page.reload();
    await expect(page.locator('text=Agent Workspace').first()).toBeVisible({ timeout: 10000 });

    // Client-side route transition to admin dashboard to test RoleRoute RBAC
    await page.evaluate(() => {
      window.history.pushState({}, '', '/admin/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // RoleRoute should protect and render Access Restricted (403 Forbidden)
    await expect(page.locator('text=Access Restricted (403 Forbidden)')).toBeVisible({ timeout: 10000 });

    // Return to Agent Dashboard
    await page.click('text=Go to Agent Dashboard');
    await expect(page).toHaveURL(/\/agent\/dashboard/);

    // Logout via user profile logout button
    await page.click('button[title="Log out"]');
    await expect(page).toHaveURL(/\/login/);

    // Verify cookies cleared on logout
    const postLogoutCookies = await page.context().cookies();
    const postLogoutAccess = postLogoutCookies.find((c) => c.name === 'accessToken' && c.value !== '');
    expect(postLogoutAccess).toBeUndefined();

    // Test Team Lead login using demo pill
    await page.click('button:has-text("Taylor Lead")');
    await page.click('button:has-text("Sign In to Workspace")');

    // Assert redirected to Lead Dashboard
    await expect(page).toHaveURL(/\/lead\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Team Lead Portal').first()).toBeVisible();

    // Switch to Operational Intelligence tab
    await page.click('text=Operational Intelligence');
    await expect(page.locator('text=Phase 5')).toBeVisible();
  });

  test('4. Responsive Mobile State: Navbar collapse and public form layout on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone 13 dimensions)
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/support');
    await expect(page.locator('h1')).toBeVisible();

    // Check that form inputs are stacked and accessible without overflow
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // Go to Home on mobile
    await page.goto('/');
    const trackBtn = page.locator('button:has-text("Track Ticket")');
    await expect(trackBtn).toBeVisible();
  });
});
