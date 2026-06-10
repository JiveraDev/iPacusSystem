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

export function fetchInventoryMeta() {
  return request("/inventory/meta");
}

export function fetchInventoryItems() {
  return request("/inventory");
}

export function createInventoryItem(payload) {
  return jsonRequest("/inventory/items", payload, {
    apiPrefix: true,
    method: "POST"
  });
}

export function updateInventoryItem(payload) {
  return jsonRequest("/inventory/items", payload, {
    apiPrefix: true,
    method: "PATCH"
  });
}

export function createStockReceipt(payload) {
  return jsonRequest("/inventory/stock-in", payload, {
    apiPrefix: true,
    method: "POST"
  });
}

export function createStockOut(payload) {
  return jsonRequest("/inventory/stock-out", payload, {
    apiPrefix: true,
    method: "POST"
  });
}

export function uploadInventoryFile(file, type = "inventory_item") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("type", type);

  return upload("/upload", formData);
}
