import { useEffect, useState } from "react";

let nextToastId = 1;
const listeners = new Set();
let currentToasts = [];

function emit() {
  listeners.forEach((listener) => listener(currentToasts));
}

function dismiss(id) {
  currentToasts = currentToasts.filter((toastItem) => toastItem.id !== id);
  emit();
}

function showToast(type, message) {
  const id = nextToastId++;
  currentToasts = [...currentToasts, { id, type, message }];
  emit();

  window.setTimeout(() => dismiss(id), 3200);
}

const toast = {
  success(message) {
    showToast("success", message);
  },
  error(message) {
    showToast("error", message);
  },
};

function ToastViewport() {
  const [toasts, setToasts] = useState(currentToasts);

  useEffect(() => {
    listeners.add(setToasts);
    return () => listeners.delete(setToasts);
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toastItem.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toastItem.message}
        </div>
      ))}
    </div>
  );
}

export { ToastViewport, toast };

