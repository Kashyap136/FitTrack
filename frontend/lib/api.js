/**
 * Centralised Axios client.
 *
 * Every network call in the app goes through this module: base URL, auth
 * headers, token persistence and error normalisation live here so components
 * never configure Axios themselves.
 */
import axios from 'axios';

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

export const TOKEN_STORAGE_KEY = 'fittrack.token';
export const USER_STORAGE_KEY = 'fittrack.user';
export const UNAUTHORIZED_EVENT = 'fittrack:unauthorized';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

/* ------------------------------------------------------------------ tokens */

export function readToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function writeToken(token) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user) {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_STORAGE_KEY);
}

/* ------------------------------------------------------------ interceptors */

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      // Expired / revoked session: drop credentials and let the app re-route.
      writeToken(null);
      writeStoredUser(null);
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(decorateError(error));
  }
);

/* ------------------------------------------------------------ error shape */

function decorateError(error) {
  if (error.code === 'ECONNABORTED') {
    return {
      message: 'The request took too long. Please try again.',
      status: 408,
      fieldErrors: {},
      raw: error,
    };
  }

  if (!error.response) {
    return {
      message: `Cannot reach the FitTrack API at ${API_BASE_URL}. Is the backend running?`,
      status: 0,
      fieldErrors: {},
      raw: error,
    };
  }

  const { status, data } = error.response;
  return {
    message: data?.message || `Request failed (${status})`,
    status,
    fieldErrors: data?.errors || {},
    raw: error,
  };
}

/** Turn any thrown value into a message that is safe to show in the UI. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

/* ------------------------------------------------------------- endpoint map */

const unwrap = (promise) => promise.then((response) => response.data);

export const authApi = {
  register: (payload) => unwrap(api.post('/auth/register', payload)),
  login: (payload) => unwrap(api.post('/auth/login', payload)),
  me: () => unwrap(api.get('/auth/me')),
  changePassword: (payload) => unwrap(api.put('/auth/password', payload)),
  logWeight: (payload) => unwrap(api.post('/auth/weight', payload)),
  weightHistory: () => unwrap(api.get('/auth/weight')),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return unwrap(
      api.post('/auth/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    );
  },
};

export const workoutApi = {
  create: (payload) => unwrap(api.post('/workouts/create', payload)),
  mine: (params = {}) => unwrap(api.get('/workouts/my', { params })),
  update: (id, payload) => unwrap(api.put(`/workouts/${id}`, payload)),
  remove: (id) => unwrap(api.delete(`/workouts/${id}`)),
  prs: () => unwrap(api.get('/workouts/prs/mine')),
};

export const feedApi = {
  list: (params = {}) => unwrap(api.get('/feed/list', { params })),
  people: () => unwrap(api.get('/feed/people')),
  summary: (params = {}) => unwrap(api.get('/feed/summary', { params })),
  comments: (workoutId) => unwrap(api.get(`/feed/comments/${workoutId}`)),
  like: (workoutId) => unwrap(api.post(`/workouts/${workoutId}/like`)),
  comment: (workoutId, text) => unwrap(api.post(`/workouts/${workoutId}/comment`, { text })),
};

export const challengeApi = {
  list: (params = {}) => unwrap(api.get('/challenges/list', { params })),
  types: () => unwrap(api.get('/challenges/types')),
  get: (id) => unwrap(api.get(`/challenges/${id}`)),
  create: (payload) => unwrap(api.post('/challenges/create', payload)),
  join: (challengeId) => unwrap(api.post('/challenges/join', { challengeId })),
  leave: (challengeId) => unwrap(api.post('/challenges/leave', { challengeId })),
  mine: () => unwrap(api.get('/challenges/mine/list')),
  log: (id) => unwrap(api.get(`/challenges/${id}/log`)),
};

export const leaderboardApi = {
  forChallenge: (challengeId) => unwrap(api.get(`/leaderboard/${challengeId}`)),
  myChallenges: () => unwrap(api.get('/leaderboard')),
};

export const statsApi = {
  byHandle: (handle) => unwrap(api.get(`/stats/${handle}`)),
  me: () => unwrap(api.get('/stats/me/summary')),
};

export const userApi = {
  me: () => unwrap(api.get('/users/me')),
  updateMe: (payload) => unwrap(api.put('/users/me', payload)),
  directory: (params = {}) => unwrap(api.get('/users/directory', { params })),
  byHandle: (handle) => unwrap(api.get(`/users/${handle}`)),
  workouts: (handle, params = {}) => unwrap(api.get(`/users/${handle}/workouts`, { params })),
};

export const settingsApi = {
  get: () => unwrap(api.get('/settings')),
  update: (payload) => unwrap(api.put('/settings', payload)),
};

export const groupApi = {
  list: () => unwrap(api.get('/groups/list')),
};

export default api;