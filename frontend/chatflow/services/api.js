import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const registerUser = (username, email, password) => {
  return api.post('/register', { username, email, password });
};

export const loginUser = (email, password) => {
  return api.post('/login', { email, password });
};

export const getCurrentUser = () => {
  return api.get('/me');
};

export const searchUsers = (username) => {
  return api.get(`/users/search?username=${username}`);
};

export const createConversation = (userId) => {
  return api.post('/conversations', { user_id: userId });
};

export const sendMessage = (conversationId, content) => {
  return api.post(`/conversations/${conversationId}/messages`, { content });
};

export const getMessages = (conversationId) => {
  return api.get(`/conversations/${conversationId}/messages`);
};

export default api;