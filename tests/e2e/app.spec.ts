import { expect, test } from './fixtures';

test('creates a D1-backed program and mesocycle', async ({ page }) => {
  await page.getByRole('button', { name: 'New program' }).click();
  await page.getByRole('dialog').locator('input').first().fill('E2E Strength Plan');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'E2E Strength Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Add mesocycle' }).click();
  await page.getByRole('dialog').locator('input').first().fill('Base Block');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Base Block' })).toBeVisible();
});

test('uses a workspace-scoped exercise library', async ({ page }) => {
  await page.getByRole('link', { name: 'Exercise Library', exact: true }).click();
  await expect(page.getByText('Back Squat', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New exercise' }).click();
  await page.getByRole('dialog').locator('input').first().fill('Front Squat');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Front Squat', { exact: true })).toBeVisible();
});

test('copies an independent program with executed values off by default', async ({ page, personas }) => {
  await page.goto(`/programs/${personas.programId}`);
  await page.getByRole('button', { name: 'Copy program' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Include executed values/)).not.toBeChecked();
  await dialog.locator('input').first().fill('Independent Copy');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Independent Copy' })).toBeVisible();
});

test('creates, switches to, and deletes a workspace', async ({ page }) => {
  const name = `E2E Workspace ${Date.now()}`;
  await page.getByRole('link', { name: 'Spaces' }).click();
  await page.getByPlaceholder('Space name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  const card = page.locator('article').filter({ hasText: name });
  await expect(card.getByText(/selected/)).toBeVisible();
  await card.locator('input').fill(name);
  await card.getByRole('button', { name: 'Delete' }).click();
  await expect(card).toHaveCount(0);
});

test('provisions a beta user only inside isolated E2E state', async ({ page }) => {
  const suffix = Date.now(), displayName = `Beta Athlete ${suffix}`;
  await page.getByRole('link', { name: 'Admin Users' }).click();
  await page.getByRole('button', { name: 'Provision user' }).click();
  const fields = page.getByRole('dialog').locator('input');
  await fields.nth(0).fill(displayName); await fields.nth(1).fill(`athlete-${suffix}@example.test`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(displayName, { exact: true })).toBeVisible();
});

test('coach releases and reclaims a client, opens their space, and sees an isolated library', async ({ page, personas }) => {
  await page.request.post('/api/local-auth/session',{data:{userId:personas.coachId}});
  await page.reload();
  await page.getByRole('link',{name:'Client assignments'}).click();
  const client=page.getByRole('row').filter({hasText:'Assigned to you'});
  await expect(client.getByRole('button',{name:/Release client/})).toBeVisible();
  await client.getByRole('button',{name:/Release client/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Release',exact:true}).click();
  await expect(page.getByRole('button',{name:/Claim client/})).toBeVisible();
  await page.getByRole('button',{name:/Claim client/}).click();
  await page.getByRole('button',{name:/Open space/}).click();
  await expect(page.getByText(/Programs belong to this client/)).toBeVisible();
  await page.getByRole('button',{name:'New program'}).click();
  await page.getByRole('dialog').locator('input').fill('Client space plan');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('link',{name:'Client space plan',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Exercise Library',exact:true}).click();
  await expect(page.getByText('Back Squat',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'New group'}).click();
  await page.getByRole('dialog').locator('input').fill('Client strength');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'New exercise'}).click();
  await page.getByRole('dialog').locator('input').first().fill('Client-only squat');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByText('Client-only squat',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Space',exact:true}).selectOption(personas.workspaceId);
  await page.getByRole('link',{name:'Exercise Library',exact:true}).click();
  await expect(page.getByText('Client-only squat',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Back Squat',{exact:true})).toBeVisible();
});

test('client sees exactly one space and cannot enter the staff assignment page', async ({ page, personas }) => {
  await page.request.post('/api/local-auth/session',{data:{userId:personas.clientId}});
  await page.reload();
  await expect(page.getByRole('link',{name:'Client assignments'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Spaces',exact:true})).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Space',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'New program'})).toHaveCount(0);
  await page.goto('/clients');
  await expect(page.getByRole('alert')).toHaveText(/available to coaches, owners, and administrators/);
});

test('copies a program into a client space and navigates to the independent copy', async ({ page, personas }) => {
  await page.goto(`/programs/${personas.programId}`);
  await page.getByRole('button',{name:'Copy program'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('input').first().fill('Client copy');
  await dialog.getByLabel('Destination space').selectOption(`client-space-${personas.clientId}`);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Client copy',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Space',exact:true})).toHaveValue(`client-space-${personas.clientId}`);
});

test('switches email identities and clears the previous account’s programs', async ({ page, personas }) => {
  await page.getByRole('button', { name: 'Switch test user' }).click();
  const dialog = page.getByRole('dialog');
  const users = (await (await page.request.get('/api/test-auth/users')).json()).data;
  const client = users.find((u: { id: string }) => u.id === personas.clientId);
  await dialog.getByRole('textbox', { name: 'Find test account' }).fill(client.email_display);
  await dialog.getByRole('button').filter({ hasText: client.email_display }).click();
  await expect(page.getByRole('button', { name: 'New program', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No current programs yet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin Users', exact: true })).toHaveCount(0);
  const privateRead = await page.request.get(`/api/workspaces/${personas.workspaceId}/programs/${personas.programId}`);
  expect(privateRead.status()).toBe(403);
  await page.getByRole('button', { name: 'Switch test user' }).click();
  await page.getByRole('button', { name: 'Return to my account' }).click();
  await expect(page.getByRole('button', { name: 'New program', exact: true })).toBeVisible();
});

test('edits a strength plan and records results with persistent save feedback', async ({ page, personas }) => {
  const root = `/api/workspaces/${personas.workspaceId}/programs/${personas.programId}`;
  const cycle = (await (await page.request.post(`${root}/mesocycles`, { data: { name: 'Training', mesocycleLength: 14, startDate: '2026-09-28' } })).json()).data;
  const workout = (await (await page.request.post(`${root}/mesocycles/${cycle.id}/workouts`, { data: { name: 'Squat day', dayOffset: 0 } })).json()).data;
  const exercises = (await (await page.request.get(`/api/workspaces/${personas.workspaceId}/exercises`)).json()).data;
  const block = (await (await page.request.post(`${root}/workouts/${workout.id}/exercises`, { data: { exerciseId: exercises[0].id, exerciseOrder: 0 } })).json()).data;
  await page.request.post(`${root}/workout-exercises/${block.id}/strength-sets`, { data: { setNumber: 1, setType: 'normal', plannedReps: 8, plannedWeight: 100 } });
  await page.goto(`/programs/${personas.programId}/workouts/${workout.id}`);
  await page.getByRole('spinbutton', { name: 'Planned reps', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Actual reps', exact: true }).fill('9');
  await page.getByRole('spinbutton', { name: 'Actual weight', exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save results', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Planned reps', exact: true })).toHaveValue('10');
  await expect(page.getByRole('spinbutton', { name: 'Actual reps', exact: true })).toHaveValue('9');
});

test('keeps mobile navigation and workout entry inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Exercise Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exercise Library', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('manages keyboard focus in the mobile navigation drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
  await expect(page.getByRole('link', { name: 'Programs', exact: true })).toHaveCount(0);
  await opener.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#main-navigation-drawer')))).toBe(true);
  await page.getByRole('button', { name: 'Log out', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#main-navigation-drawer')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('records a cardio result with the planned unit and preserves it on reload', async ({ page, personas }) => {
  const root = `/api/workspaces/${personas.workspaceId}/programs/${personas.programId}`;
  const group = (await (await page.request.get(`/api/workspaces/${personas.workspaceId}/exercise-groups`)).json()).data[0];
  const exercise = (await (await page.request.post(`/api/workspaces/${personas.workspaceId}/exercises`, { data: { exerciseGroupId: group.id, name: 'Bike intervals', exerciseType: 'cardio' } })).json()).data;
  const cycle = (await (await page.request.post(`${root}/mesocycles`, { data: { name: 'Conditioning', startDate: '2026-09-28' } })).json()).data;
  const workout = (await (await page.request.post(`${root}/mesocycles/${cycle.id}/workouts`, { data: { name: 'Easy ride', dayOffset: 0 } })).json()).data;
  const block = (await (await page.request.post(`${root}/workouts/${workout.id}/exercises`, { data: { exerciseId: exercise.id, exerciseOrder: 0 } })).json()).data;
  await page.request.post(`${root}/workout-exercises/${block.id}/cardio-sets`, { data: { setNumber: 1, plannedDurationSeconds: 600, plannedDistance: 3, distanceUnit: 'km', targetRpe: 4 } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/programs/${personas.programId}/workouts/${workout.id}`);
  await page.getByRole('spinbutton', { name: 'Actual seconds' }).fill('660');
  await page.getByRole('spinbutton', { name: 'Actual distance' }).fill('3.2');
  await page.getByRole('spinbutton', { name: 'Actual RPE' }).fill('5');
  await page.getByRole('button', { name: 'Save results' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Actual seconds' })).toHaveValue('660');
  await expect(page.getByRole('spinbutton', { name: 'Actual distance' })).toHaveValue('3.2');
  await expect(page.getByRole('combobox', { name: 'Distance unit' })).toHaveValue('km');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('shows a competing assignment error inside the coach dialog', async ({ page, personas }) => {
  await page.getByRole('link', { name: 'Client assignments', exact: true }).click();
  const assignments = (await (await page.request.get('/api/clients')).json()).data;
  const client = assignments.find((row: { client_user_id: string }) => row.client_user_id === personas.clientId);
  await page.getByRole('textbox', { name: 'Search clients or coaches' }).fill(client.email_display);
  await page.getByRole('button', { name: /^Force release/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Release', exact: true }).click();
  await page.getByRole('button', { name: /^Assign coach for/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Coach', { exact: true }).selectOption(personas.coachId);
  const competing = await page.request.post(`/api/clients/${personas.clientId}/claim`, { data: {} });
  expect(competing.status()).toBe(201);
  await dialog.getByRole('button', { name: 'Assign coach', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/already been claimed/);
  await expect(dialog.getByLabel('Coach', { exact: true })).toHaveValue(personas.coachId);
});
