import api from './client';

export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const documentsApi = {
  upload: (file, knowledgeBaseId) => {
    const form = new FormData();
    form.append('file', file);
    if (knowledgeBaseId) form.append('knowledge_base_id', knowledgeBaseId);
    return api.post('/documents/upload', form).then((r) => r.data);
  },
  list: () => api.get('/documents').then((r) => r.data),
  get: (id) => api.get(`/documents/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
};

export const chatApi = {
  send: (payload) => api.post('/chat', payload).then((r) => r.data),
  list: () => api.get('/chat').then((r) => r.data),
  messages: (chatId) => api.get(`/chat/${chatId}/messages`).then((r) => r.data),
  remove: (chatId) => api.delete(`/chat/${chatId}`).then((r) => r.data),
};

export const providersApi = {
  list: () => api.get('/providers').then((r) => r.data),
  upsert: (payload) => api.put('/providers', payload).then((r) => r.data),
  models: (provider) => api.get('/providers/models', { params: { provider } }).then((r) => r.data),
  remove: (provider) => api.delete(`/providers/${provider}`).then((r) => r.data),
};

export const knowledgeBasesApi = {
  list: () => api.get('/knowledge-bases').then((r) => r.data),
  create: (payload) => api.post('/knowledge-bases', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/knowledge-bases/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/knowledge-bases/${id}`).then((r) => r.data),
};

export const adminApi = {
  users: () => api.get('/admin/users').then((r) => r.data),
  changeRole: (userId, role) =>
    api.patch(`/admin/users/${userId}/role`, { role }).then((r) => r.data),
  stats: () => api.get('/admin/stats').then((r) => r.data),
};

export const PROVIDERS = [
  'openai',
  'anthropic',
  'groq',
  'gemini',
  'azure',
  'mistral',
  'together',
  'ollama',
];