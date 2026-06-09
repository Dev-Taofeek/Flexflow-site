const DEFAULT_API_URL = "http://localhost:4000/api";

export function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const base = raw.trim().replace(/\/+$/, "");

  return base.endsWith("/api") ? base : `${base}/api`;
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
