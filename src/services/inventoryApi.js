const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getApiUrl(path) {
  const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return normalizedBaseUrl.endsWith("/api")
    ? `${normalizedBaseUrl}${normalizedPath}`
    : `${normalizedBaseUrl}/api${normalizedPath}`;
}

async function request(path, options = {}) {
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "null");
}

export function fetchInventoryMeta() {
  return request("/inventory/meta");
}

export function fetchInventoryItems() {
  return request("/inventory");
}

export function createInventoryItem(payload) {
  return request("/inventory/items", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createStockReceipt(payload) {
  return request("/inventory/stock-in", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createStockOut(payload) {
  return request("/inventory/stock-out", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
