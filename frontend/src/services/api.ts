import { useAppStore } from '../store/appStore';

const BASE_URL = import.meta.env.VITE_API_URL || ''; // In production: Render backend URL. In dev: empty (Vite proxy handles it)

async function request(url: string, options: RequestInit = {}) {
  const { token, activeYear } = useAppStore.getState();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (activeYear) {
    headers.set('x-academic-year-id', activeYear.id);
  }

  let cleanedUrl = url;
  if (BASE_URL) {
    const hasApiSuffix = BASE_URL.replace(/\/$/, '').endsWith('/api');
    if (hasApiSuffix && url.startsWith('/api/')) {
      cleanedUrl = url.substring(4); // Remove "/api"
    }
  }

  const response = await fetch(`${BASE_URL}${cleanedUrl}`, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    // Session expired or token invalid/forbidden
    useAppStore.getState().logout();
    throw new Error('Session expired, please login again.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

export const api = {
  get: (url: string) => request(url, { method: 'GET' }),
  post: (url: string, body: any) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url: string, body: any) => request(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url: string) => request(url, { method: 'DELETE' }),
};
