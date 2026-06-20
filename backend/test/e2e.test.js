const BASE = 'http://localhost:4000';
let failures = 0;

function check(label, cond) {
  if (cond) {
    console.log(`PASS  ${label}`);
  } else {
    console.log(`FAIL  ${label}`);
    failures++;
  }
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  check('health check', health.ok === true);

  const email = `test${Date.now()}@example.com`;
  const signup = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SuperSecret123' }),
  }).then((r) => r.json());
  check('signup returns token', !!signup.token);
  const token = signup.token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const dupSignup = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SuperSecret123' }),
  });
  check('duplicate signup rejected (409)', dupSignup.status === 409);

  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SuperSecret123' }),
  }).then((r) => r.json());
  check('login returns token', !!login.token);

  const badLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'WrongPassword' }),
  });
  check('wrong password rejected (401)', badLogin.status === 401);

  const noToken = await fetch(`${BASE}/tasks`);
  check('protected route rejects missing token (401)', noToken.status === 401);

  const setupMaster = await fetch(`${BASE}/auth/master-password/setup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ masterPassword: 'MyVaultMaster1' }),
  });
  check('master password setup succeeds', setupMaster.status === 200);

  const unlockOk = await fetch(`${BASE}/auth/master-password/unlock`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ masterPassword: 'MyVaultMaster1' }),
  });
  check('master password unlock with correct password', unlockOk.status === 200);

  const unlockBad = await fetch(`${BASE}/auth/master-password/unlock`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ masterPassword: 'WrongMaster' }),
  });
  check('master password unlock rejects wrong password (401)', unlockBad.status === 401);

  const createTask = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Upload SUNORA contract', dueDate: new Date().toISOString(), projectTag: 'SUNORA' }),
  }).then((r) => r.json());
  check('task created', !!createTask.task?.id);
  const taskId = createTask.task.id;

  const emptyTask = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: '   ' }),
  });
  check('empty task title rejected (400)', emptyTask.status === 400);

  const listTasks = await fetch(`${BASE}/tasks`, { headers: authHeaders }).then((r) => r.json());
  check('task list contains created task', listTasks.tasks.some((t) => t.id === taskId));

  const completeTask = await fetch(`${BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ completed: true }),
  }).then((r) => r.json());
  check('task marked completed', completeTask.task.completed === true);

  const doneFilter = await fetch(`${BASE}/tasks?filter=done`, { headers: authHeaders }).then((r) => r.json());
  check('done filter shows completed task', doneFilter.tasks.some((t) => t.id === taskId));

  const delTask = await fetch(`${BASE}/tasks/${taskId}`, { method: 'DELETE', headers: authHeaders });
  check('task soft-deleted', delTask.status === 200);

  const listAfterDelete = await fetch(`${BASE}/tasks`, { headers: authHeaders }).then((r) => r.json());
  check('deleted task absent from main list', !listAfterDelete.tasks.some((t) => t.id === taskId));

  const noteItem = await fetch(`${BASE}/vault/text`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'sunora.ae admin link', itemType: 'link', textValue: 'https://sunora.ae/wp-admin' }),
  }).then((r) => r.json());
  check('link vault item created', !!noteItem.item?.id);
  const vaultItemId = noteItem.item.id;

  const badType = await fetch(`${BASE}/vault/text`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'x', itemType: 'bogus', textValue: 'y' }),
  });
  check('invalid vault item type rejected (400)', badType.status === 400);

  const vaultList = await fetch(`${BASE}/vault?type=link`, { headers: authHeaders }).then((r) => r.json());
  check('vault filter by type works', vaultList.items.some((i) => i.id === vaultItemId));

  const vaultSearch = await fetch(`${BASE}/vault?search=sunora`, { headers: authHeaders }).then((r) => r.json());
  check('vault search works', vaultSearch.items.some((i) => i.id === vaultItemId));

  const fileForm = new FormData();
  fileForm.append('title', 'VAC_contract_2026.pdf');
  fileForm.append('itemType', 'pdf');
  fileForm.append('file', new Blob([Buffer.from('%PDF-1.4 fake pdf content')], { type: 'application/pdf' }), 'VAC_contract_2026.pdf');
  const fileUpload = await fetch(`${BASE}/vault/file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fileForm,
  }).then((r) => r.json());
  check('file upload created vault item', !!fileUpload.item?.id);
  const fileItemId = fileUpload.item.id;

  const download = await fetch(`${BASE}/vault/${fileItemId}/download`, { headers: authHeaders });
  check('download endpoint returns file', download.status === 200);

  const delVaultItem = await fetch(`${BASE}/vault/${vaultItemId}`, { method: 'DELETE', headers: authHeaders });
  check('vault item soft-deleted', delVaultItem.status === 200);

  const createPwdNoMaster = await fetch(`${BASE}/passwords/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Gmail', password: 'EmailPass123' }),
  });
  check('password create without master password rejected (401)', createPwdNoMaster.status === 401);

  const createPwd = await fetch(`${BASE}/passwords/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Gmail',
      username: 'memonaaslam00@gmail.com',
      password: 'EmailPass123',
      masterPassword: 'MyVaultMaster1',
    }),
  }).then((r) => r.json());
  check('password item created with master password', !!createPwd.id);
  const pwdId = createPwd.id;

  const listPwdWrongMaster = await fetch(`${BASE}/passwords/list`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ masterPassword: 'WrongMaster' }),
  });
  check('password list rejects wrong master password (401)', listPwdWrongMaster.status === 401);

  const listPwd = await fetch(`${BASE}/passwords/list`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ masterPassword: 'MyVaultMaster1' }),
  }).then((r) => r.json());
  const decrypted = listPwd.items.find((i) => i.id === pwdId);
  check('password decrypts correctly with right master password', decrypted?.password === 'EmailPass123');

  const updatePwd = await fetch(`${BASE}/passwords/${pwdId}/update`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ password: 'NewEmailPass456', masterPassword: 'MyVaultMaster1' }),
  });
  check('password update succeeds', updatePwd.status === 200);

  const listPwd2 = await fetch(`${BASE}/passwords/list`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ masterPassword: 'MyVaultMaster1' }),
  }).then((r) => r.json());
  const updated = listPwd2.items.find((i) => i.id === pwdId);
  check('updated password decrypts to new value', updated?.password === 'NewEmailPass456');

  const exportBeforeDelete = await fetch(`${BASE}/backup/export`, { headers: authHeaders }).then((r) => r.json());
  const exportedPwd = exportBeforeDelete.encryptedPasswords.find((p) => p.id === pwdId);
  check('active password appears encrypted in export', exportedPwd?.enc_password !== undefined && exportedPwd.enc_password !== 'NewEmailPass456');

  const delPwd = await fetch(`${BASE}/passwords/${pwdId}/delete`, { method: 'POST', headers: authHeaders });
  check('password soft-deleted', delPwd.status === 200);

  const recycleList = await fetch(`${BASE}/recycle-bin`, { headers: authHeaders }).then((r) => r.json());
  const recycledTypes = recycleList.items.map((i) => i.type);
  check('recycle bin shows deleted task', recycledTypes.includes('task'));
  check('recycle bin shows deleted vault item', recycledTypes.includes('vault_item'));
  check('recycle bin shows deleted password', recycledTypes.includes('password'));

  const restoreTask = await fetch(`${BASE}/recycle-bin/task/${taskId}/restore`, {
    method: 'POST',
    headers: authHeaders,
  });
  check('restore task from recycle bin', restoreTask.status === 200);

  const listAfterRestore = await fetch(`${BASE}/tasks`, { headers: authHeaders }).then((r) => r.json());
  check('restored task reappears in main list', listAfterRestore.tasks.some((t) => t.id === taskId));

  const permDelete = await fetch(`${BASE}/recycle-bin/vault_item/${vaultItemId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  check('permanent delete from recycle bin works', permDelete.status === 200);

  const exportBackup = await fetch(`${BASE}/backup/export`, { headers: authHeaders }).then((r) => r.json());
  check('backup export includes tasks array', Array.isArray(exportBackup.tasks));
  check('backup export passwords array is encrypted-shape', Array.isArray(exportBackup.encryptedPasswords));
  check('deleted password correctly excluded from export', !exportBackup.encryptedPasswords.some((p) => p.id === pwdId));

  const driveNoToken = await fetch(`${BASE}/backup/drive/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  check('drive upload without access token rejected (400)', driveNoToken.status === 400);

  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Test run crashed:', e);
  process.exit(1);
});
