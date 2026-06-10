import { apiRequest, deleteRequest, patchJson, postJson } from './apiClient';

function todosQuery(userId, params = {}) {
    const query = new URLSearchParams({ userId });

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, value);
        }
    });

    return query.toString();
}

export function fetchPetOwnerTodos(userId, params = {}, options = {}) {
    return apiRequest(`/users/${userId}/todos?${todosQuery(userId, params)}`, options);
}

export function createPetOwnerTodo(userId, payload, options = {}) {
    return postJson('/todos', { ...payload, user_id: userId }, options);
}

export function updatePetOwnerTodo(todoId, userId, payload, options = {}) {
    return patchJson(`/todos/${todoId}`, { ...payload, user_id: userId }, options);
}

export function deletePetOwnerTodo(todoId, userId, options = {}) {
    return deleteRequest(`/todos/${todoId}?${todosQuery(userId)}`, options);
}
