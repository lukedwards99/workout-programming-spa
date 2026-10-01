import { expect, test as base } from '@playwright/test';

export interface TestPersonas { workspaceId: string; ownerId: string; coachId: string; clientId: string; programId: string; }

export const test = base.extend<{ personas: TestPersonas }>({
  personas: [async ({ page }, use, testInfo) => {
    const response = await page.request.post('/api/testing/fixtures', { data: { label: testInfo.title.slice(0, 60) } });
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as { data: TestPersonas };
    const login = await page.request.post('/api/local-auth/session', { data: { userId: payload.data.ownerId } });
    expect(login.ok()).toBeTruthy();
    await page.addInitScript((workspaceId) => localStorage.setItem('liftlog-workspace-id', workspaceId), payload.data.workspaceId);
    await page.goto('/');
    await expect(page.getByTestId('app-ready')).toBeVisible();
    await use(payload.data);
  }, { auto: true }],
});

export { expect };
