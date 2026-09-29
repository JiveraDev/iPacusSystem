import { apiRequest, jsonRequest } from './apiClient';

function request(path, options = {}) {
  return apiRequest(path, {
    apiPrefix: true,
    ...options
  });
}

function upload(path, formData) {
  return apiRequest(path, {
    apiPrefix: true,
    method: "POST",
    body: formData
  });
}

export function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "null");
}

export function fetchInventoryMeta(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/inventory/meta${query ? `?${query}` : ''}`);
}

export function fetchInventoryItems(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/inventory${query ? `?${query}` : ''}`);
}

export function createInventoryItem(payload) {
  return jsonRequest(branchScopedPath('/inventory/items', payload), payload, {
    apiPrefix: true,
    method: "POST"
  });
}

export function updateInventoryItem(payload) {
  return jsonRequest(branchScopedPath('/inventory/items', payload), payload, {
    apiPrefix: true,
    method: "PATCH"
  });
}

export function createStockReceipt(payload) {
  return jsonRequest(branchScopedPath('/inventory/stock-in', payload), payload, {
    apiPrefix: true,
    method: "POST"
  });
}

export function createStockOut(payload) {
  return jsonRequest(branchScopedPath('/inventory/stock-out', payload), payload, {
    apiPrefix: true,
    method: "POST"
  });
}

export function transferInventoryStock(payload) {
  return jsonRequest(branchScopedPath('/inventory/transfer', payload), payload, {
    apiPrefix: true,
    method: 'POST'
  });
}

export function deleteInventoryItem(payload) {
  return jsonRequest(branchScopedPath('/inventory/delete', payload), payload, {
    apiPrefix: true,
    method: 'POST'
  });
}

function branchScopedPath(path, payload = {}) {
  const branchId = payload.branch_id ?? payload.branchId;
  if (!branchId) return path;
  const query = new URLSearchParams({ branchId: String(branchId) });
  return `${path}?${query.toString()}`;
}

export function uploadInventoryFile(file, type = "inventory_item") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("type", type);

  return upload("/upload", formData);
}
