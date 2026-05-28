const normalizeApiBaseUrl = (value) => {
  const trimmedValue = (value || '').trim().replace(/\/$/, '');

  if (!trimmedValue) return '';
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmedValue)) {
    return `http://${trimmedValue}`;
  }

  return trimmedValue;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
