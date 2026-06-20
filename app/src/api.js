import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

async function getToken() {
  return AsyncStorage.getItem('token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const token = await getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && data.error) || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
  return data;
}

export const api = {
  signup: (email, password) => request('/auth/signup', { method: 'POST', body: { email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  setupMasterPassword: (masterPassword) =>
    request('/auth/master-password/setup', { method: 'POST', body: { masterPassword } }),
  unlockMasterPassword: (masterPassword) =>
    request('/auth/master-password/unlock', { method: 'POST', body: { masterPassword } }),

  listTasks: (filter) => request(`/tasks${filter ? `?filter=${filter}` : ''}`),
  createTask: (task) => request('/tasks', { method: 'POST', body: task }),
  updateTask: (id, patch) => request(`/tasks/${id}`, { method: 'PATCH', body: patch }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  listVault: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/vault${qs ? `?${qs}` : ''}`);
  },
  createVaultText: (item) => request('/vault/text', { method: 'POST', body: item }),
  uploadVaultFile: (formData) => request('/vault/file', { method: 'POST', body: formData, isForm: true }),
  updateVaultItem: (id, patch) => request(`/vault/${id}`, { method: 'PATCH', body: patch }),
  deleteVaultItem: (id) => request(`/vault/${id}`, { method: 'DELETE' }),
  downloadUrl: (id) => `${API_BASE}/vault/${id}/download`,

  listPasswords: (masterPassword) => request('/passwords/list', { method: 'POST', body: { masterPassword } }),
  createPassword: (item, masterPassword) =>
    request('/passwords/create', { method: 'POST', body: { ...item, masterPassword } }),
  updatePassword: (id, item, masterPassword) =>
    request(`/passwords/${id}/update`, { method: 'POST', body: { ...item, masterPassword } }),
  deletePassword: (id) => request(`/passwords/${id}/delete`, { method: 'POST' }),

  recycleBin: () => request('/recycle-bin'),
  restoreFromRecycleBin: (type, id) => request(`/recycle-bin/${type}/${id}/restore`, { method: 'POST' }),
  permanentlyDelete: (type, id) => request(`/recycle-bin/${type}/${id}`, { method: 'DELETE' }),

  exportBackup: () => request('/backup/export'),
  uploadToDrive: (accessToken) =>
    request('/backup/drive/upload', { method: 'POST', body: { accessToken } }),
  backupHistory: () => request('/backup/history'),
};
