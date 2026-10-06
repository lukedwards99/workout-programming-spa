import { expect, test } from './fixtures';

test('coach creates multiple personal spaces separately from client training', async ({ page, personas }) => {
  await page.request.post('/api/local-auth/session', { data: { userId: personas.coachId } });
  await page.goto('/workspaces');
  const mine = page.getByRole('region', { name: 'My spaces', exact: true });
  const clients = page.getByRole('region', { name: 'Client spaces', exact: true });
  const team = page.getByRole('region', { name: 'Team', exact: true });
  await expect(clients.getByText('Assigned coach access', { exact: true })).toBeVisible();
  await expect(team.getByRole('button', { name: /Open team workspace/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Space type' })).toHaveCount(0);
  for (const name of ['My training', 'Program templates']) {
    await mine.getByLabel('Personal space name').fill(name);
    await mine.getByRole('button', { name: 'Create personal space' }).click();
    await expect(mine.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const picker = page.getByRole('combobox', { name: 'Space', exact: true });
  await expect(picker.locator('optgroup[label="My spaces"] option')).toHaveCount(2);
  await expect(picker.locator('optgroup[label="Client spaces"] option')).toHaveCount(1);
  await expect(picker.locator('optgroup[label="Team"] option')).toHaveCount(1);
  const spaces = (await (await page.request.get('/api/workspaces')).json()).data;
  const personal = spaces.filter((space: { kind: string }) => space.kind === 'personal');
  expect(personal).toHaveLength(2);
  expect(personal.every((space: { personal_owner_user_id: string; client_user_id: string | null }) => space.personal_owner_user_id === personas.coachId && space.client_user_id === null)).toBe(true);
  await mine.getByRole('button', { name: 'Open space My training', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Programs', exact: true })).toBeVisible();
  await expect(page.getByText('Your private space', { exact: true })).toBeVisible();
});

test('organization owner access is distinct from owning a client space', async ({ page, personas }) => {
  const response = await page.request.post('/api/admin/users', { data: { email: `${personas.ownerId}@owner.example.test`, displayName: 'Organization owner', status: 'active', workspaceId: personas.workspaceId, role: 'owner' } });
  expect(response.status()).toBe(201);
  const owner = (await response.json()).data;
  await page.request.post('/api/local-auth/session', { data: { userId: owner.id } });
  await page.goto('/workspaces');
  await expect(page.getByRole('region', { name: 'Client spaces', exact: true }).getByText('Organization owner access', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Space', exact: true }).selectOption(`client-space-${personas.clientId}`);
  await expect(page.locator('.account-strip').getByText('Organization owner access', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin Users', exact: true })).toHaveCount(0);
});

test('coach assignment keeps the existing client space and opens it from confirmation', async ({ page, personas }) => {
  await page.goto('/clients');
  const assignments = (await (await page.request.get('/api/clients')).json()).data;
  const client = assignments.find((row: { client_user_id: string }) => row.client_user_id === personas.clientId);
  await page.getByRole('textbox', { name: 'Search clients or coaches' }).fill(client.email_display);
  await page.getByRole('button', { name: /^Force release/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Release', exact: true }).click();
  await page.getByRole('button', { name: /^Assign coach for/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(client.space_name, { exact: true })).toBeVisible();
  await dialog.getByLabel('Coach', { exact: true }).selectOption(personas.coachId);
  await dialog.getByRole('button', { name: 'Assign coach', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const status = page.getByRole('status');
  await expect(status).toContainText(client.space_name);
  await expect(status).toContainText(client.coach_name);
  await status.getByRole('button', { name: /^Open client space/ }).click();
  await expect(page.getByRole('combobox', { name: 'Space', exact: true })).toHaveValue(client.space_id);
  const updated = (await (await page.request.get('/api/clients')).json()).data.find((row: { client_user_id: string }) => row.client_user_id === personas.clientId);
  expect(updated.space_id).toBe(client.space_id);
  expect(updated.coach_user_id).toBe(personas.coachId);
});

test('captures spaces and assignment views for review', async ({ page }, testInfo) => {
  // Use short, synthetic names for review screenshots in isolated E2E D1 state.
  const response = await page.request.post('/api/testing/fixtures', { data: { label: 'Northside' } });
  const personas = (await response.json()).data;
  await page.addInitScript(workspaceId => localStorage.setItem('liftlog-workspace-id', workspaceId), personas.workspaceId);
  await page.request.post('/api/local-auth/session', { data: { userId: personas.coachId } });
  await page.goto('/workspaces');
  for (const name of ['My training', 'Program templates']) {
    await page.getByLabel('Personal space name').fill(name);
    await page.getByRole('button', { name: 'Create personal space' }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  for (const [device, width] of [['desktop', 1440], ['mobile', 390]] as const) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`spaces-${device}.jpg`), fullPage: true, type: 'jpeg', quality: 85, animations: 'disabled' });
  }
  await page.request.post('/api/local-auth/session', { data: { userId: personas.ownerId } });
  await page.goto('/clients');
  const assignments = (await (await page.request.get('/api/clients')).json()).data;
  const client = assignments.find((row: { client_user_id: string }) => row.client_user_id === personas.clientId);
  await page.getByRole('textbox', { name: 'Search clients or coaches' }).fill(client.email_display);
  await page.getByRole('button', { name: /^Force release/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Release', exact: true }).click();
  await page.getByRole('button', { name: /^Assign coach for/ }).click();
  await page.getByRole('dialog').getByLabel('Coach', { exact: true }).selectOption(personas.coachId);
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  for (const [device, width] of [['desktop', 1440], ['mobile', 390]] as const) {
    await page.setViewportSize({ width, height: 960 });
    await page.screenshot({ path: testInfo.outputPath(`assignment-${device}.jpg`), fullPage: true, type: 'jpeg', quality: 85, animations: 'disabled' });
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Assign coach', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Northside Coach');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: testInfo.outputPath('assignment-success.jpg'), fullPage: true, type: 'jpeg', quality: 85, animations: 'disabled' });
  await page.request.post('/api/local-auth/session', { data: { userId: personas.clientId } });
  await page.goto('/workspaces');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('combobox', { name: 'Space', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('client-training-mobile.jpg'), fullPage: true, type: 'jpeg', quality: 85, animations: 'disabled' });
});
