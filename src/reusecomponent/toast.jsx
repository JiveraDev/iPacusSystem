import { useEffect, useSyncExternalStore } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { DEFAULT_ERROR_MESSAGE, getUserFacingErrorMessage } from '../lib/errorPresentation.js';

const AUTO_DISMISS_MS = 2500;
const EXIT_ANIMATION_MS = 260;
const MAX_VISIBLE_TOASTS = 4;
const MIN_DURATION_MS = 2500;
const MAX_DURATION_MS = 2500;

const TYPE_DETAILS = {
  success: {
    title: 'Completed successfully',
    description: 'The requested action has been completed.',
    icon: CheckCircle2,
    accentClass: 'bg-emerald-500',
    iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300',
  },
  error: {
    title: 'Something went wrong',
    description: DEFAULT_ERROR_MESSAGE,
    icon: AlertCircle,
    accentClass: 'bg-red-500',
    iconClass: 'bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-300',
  },
  warning: {
    title: 'Please review',
    description: 'Review the information and try again.',
    icon: AlertTriangle,
    accentClass: 'bg-amber-500',
    iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
  },
  info: {
    title: 'Information',
    description: 'New information is available.',
    icon: Info,
    accentClass: 'bg-blue-500',
    iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-300',
  },
};

let nextToastId = 1;
const EMPTY_TOASTS = [];
const listeners = new Set();
const autoDismissTimers = new Map();
const removalTimers = new Map();
const pauseReasons = new Map();
let currentToasts = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getToastSnapshot() {
  return currentToasts;
}

function getServerToastSnapshot() {
  return EMPTY_TOASTS;
}

function clearTimer(timerMap, id) {
  const timer = timerMap.get(id);
  if (timer !== undefined) window.clearTimeout(timer);
  timerMap.delete(id);
}

function removeToast(id, shouldEmit = true) {
  currentToasts = currentToasts.filter((toastItem) => toastItem.id !== id);
  clearTimer(autoDismissTimers, id);
  clearTimer(removalTimers, id);
  pauseReasons.delete(id);
  if (shouldEmit) emit();
}

function scheduleAutoDismiss(id, duration) {
  clearTimer(autoDismissTimers, id);
  const timer = window.setTimeout(() => dismiss(id), duration);
  autoDismissTimers.set(id, timer);
}

function dismiss(id) {
  if (!currentToasts.some((toastItem) => toastItem.id === id && toastItem.phase !== 'exiting')) return;

  clearTimer(autoDismissTimers, id);
  pauseReasons.delete(id);
  currentToasts = currentToasts.map((toastItem) => (
    toastItem.id === id ? { ...toastItem, phase: 'exiting' } : toastItem
  ));
  emit();

  const timer = window.setTimeout(() => removeToast(id), EXIT_ANIMATION_MS);
  removalTimers.set(id, timer);
}

function pauseToast(id, reason = 'interaction') {
  const reasons = pauseReasons.get(id) || new Set();
  reasons.add(reason);
  pauseReasons.set(id, reasons);

  const toastItem = currentToasts.find((item) => item.id === id);
  if (!toastItem || toastItem.phase === 'exiting' || toastItem.isPaused) return;

  const elapsed = Math.max(0, Date.now() - toastItem.startedAt);
  const remainingMs = Math.max(0, toastItem.remainingMs - elapsed);
  clearTimer(autoDismissTimers, id);
  currentToasts = currentToasts.map((item) => (
    item.id === id ? { ...item, isPaused: true, remainingMs } : item
  ));
  emit();
}

function resumeToast(id, reason = 'interaction') {
  const reasons = pauseReasons.get(id);
  if (reasons) {
    reasons.delete(reason);
    if (reasons.size > 0) return;
    pauseReasons.delete(id);
  }

  const toastItem = currentToasts.find((item) => item.id === id);
  if (!toastItem || toastItem.phase === 'exiting' || !toastItem.isPaused) return;
  if (toastItem.remainingMs <= 0) {
    dismiss(id);
    return;
  }

  const startedAt = Date.now();
  currentToasts = currentToasts.map((item) => (
    item.id === id ? { ...item, isPaused: false, startedAt } : item
  ));
  emit();
  scheduleAutoDismiss(id, toastItem.remainingMs);
}

function textValue(value) {
  if (value instanceof Error) return value.message;
  return String(value || '').trim();
}

function normalizeContent(type, input, options = {}) {
  const structuredInput = input && typeof input === 'object' && !(input instanceof Error)
    ? input
    : {};
  const defaultTitle = TYPE_DETAILS[type]?.title || TYPE_DETAILS.info.title;
  const rawTitle = textValue(options.title || structuredInput.title || defaultTitle);
  const rawDescription = textValue(
    options.description
    || structuredInput.description
    || structuredInput.message
    || input
  );
  const defaultDescription = TYPE_DETAILS[type]?.description || TYPE_DETAILS.info.description;

  return {
    title: getUserFacingErrorMessage(rawTitle, defaultTitle, {
      context: 'Technical toast title details were hidden from the user interface.',
    }),
    description: getUserFacingErrorMessage(rawDescription, defaultDescription, {
      context: 'Technical toast details were hidden from the user interface.',
    }),
  };
}

function showToast(type, input, options = {}) {
  const id = nextToastId++;
  const content = normalizeContent(type, input, options);
  const requestedDuration = Number(options.duration);
  const duration = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, requestedDuration))
    : AUTO_DISMISS_MS;
  const nextToast = {
    id,
    type,
    ...content,
    duration,
    remainingMs: duration,
    startedAt: Date.now(),
    isPaused: false,
    phase: 'entering',
  };

  if (currentToasts.length >= MAX_VISIBLE_TOASTS) {
    removeToast(currentToasts[0].id, false);
  }

  currentToasts = [...currentToasts, nextToast];
  emit();

  if (typeof document !== 'undefined' && document.hidden) {
    pauseToast(id, 'visibility');
  } else {
    scheduleAutoDismiss(id, duration);
  }
  return id;
}

const toast = {
  success(input, options) {
    return showToast('success', input, options);
  },
  error(input, options) {
    return showToast('error', input, options);
  },
  info(input, options) {
    return showToast('info', input, options);
  },
  warning(input, options) {
    return showToast('warning', input, options);
  },
  dismiss,
};

function ToastCard({ toastItem }) {
  const details = TYPE_DETAILS[toastItem.type] || TYPE_DETAILS.info;
  const Icon = details.icon;

  return (
    <div
      data-slot="toast"
      onMouseEnter={() => pauseToast(toastItem.id, 'pointer')}
      onMouseLeave={() => resumeToast(toastItem.id, 'pointer')}
      onFocusCapture={() => pauseToast(toastItem.id, 'focus')}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          resumeToast(toastItem.id, 'focus');
        }
      }}
      className={`ipawcus-toast pointer-events-auto relative min-h-[5.75rem] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-16px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900 ${
        toastItem.phase === 'exiting' ? 'ipawcus-toast-exit' : 'ipawcus-toast-enter'
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 ${details.accentClass}`} aria-hidden="true" />
      <div className="flex gap-3.5 px-4 py-4 pl-5 sm:gap-4 sm:px-5 sm:py-5 sm:pl-6">
        <div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${details.iconClass}`}>
          <Icon className="size-5" strokeWidth={2.4} aria-hidden="true" />
        </div>
        <div
          role={toastItem.type === 'error' ? 'alert' : 'status'}
          aria-atomic="true"
          className="min-w-0 flex-1 pr-1"
        >
          <p className="text-base font-black leading-5 text-slate-950 dark:text-white">
            {toastItem.title}
          </p>
          <p className="mt-1.5 break-words text-sm font-medium leading-5 text-slate-600 dark:text-slate-300">
            {toastItem.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismiss(toastItem.id)}
          className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus:ring-offset-slate-900"
          aria-label={`Dismiss ${toastItem.title}`}
        >
          <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-slate-100 dark:bg-slate-800" aria-hidden="true">
        <div
          className={`ipawcus-toast-progress h-full ${details.accentClass}`}
          style={{
            animationDuration: `${toastItem.duration}ms`,
            animationPlayState: toastItem.isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}

function ToastViewport() {
  const toasts = useSyncExternalStore(subscribe, getToastSnapshot, getServerToastSnapshot);

  useEffect(() => {
    const handleVisibilityChange = () => {
      currentToasts.forEach((toastItem) => {
        if (document.hidden) pauseToast(toastItem.id, 'visibility');
        else resumeToast(toastItem.id, 'visibility');
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div
      className="ipawcus-toast-viewport pointer-events-none fixed left-1/2 top-4 z-[2300] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 flex-col gap-3 overflow-y-auto sm:top-6"
      aria-label="Notifications"
    >
      {toasts.map((toastItem) => <ToastCard key={toastItem.id} toastItem={toastItem} />)}
    </div>
  );
}

export { ToastViewport };
// eslint-disable-next-line react-refresh/only-export-components
export { toast };
