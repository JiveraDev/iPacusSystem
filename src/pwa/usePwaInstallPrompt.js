import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearCapturedPwaInstallPrompt,
  initializePwaInstallPromptCapture,
  isPwaActivated,
  subscribePwaInstallPrompt,
} from './pwaConfig';

function isStandaloneDisplay() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || Boolean(navigator.standalone);
}

export function usePwaInstallPrompt() {
  const isEnabled = isPwaActivated();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplay());
  const [isPromptPending, setIsPromptPending] = useState(false);

  useEffect(() => {
    if (!isEnabled) {
      setInstallPrompt(null);
      setIsInstalled(false);
      return undefined;
    }

    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');

    const refreshInstalledState = () => {
      setIsInstalled(isStandaloneDisplay());
    };

    initializePwaInstallPromptCapture();
    const unsubscribe = subscribePwaInstallPrompt(({ prompt, installed }) => {
      setInstallPrompt(prompt);
      if (installed) {
        setIsInstalled(true);
      }
    });
    standaloneQuery?.addEventListener?.('change', refreshInstalledState);

    return () => {
      unsubscribe();
      standaloneQuery?.removeEventListener?.('change', refreshInstalledState);
    };
  }, [isEnabled]);

  const install = useCallback(async () => {
    if (!isEnabled || !installPrompt || isPromptPending) {
      return { outcome: 'unavailable' };
    }

    setIsPromptPending(true);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      clearCapturedPwaInstallPrompt();

      return choice;
    } finally {
      setIsPromptPending(false);
    }
  }, [installPrompt, isPromptPending, isEnabled]);

  return useMemo(() => {
    const canInstall = isEnabled && Boolean(installPrompt) && !isInstalled;

    return {
      canInstall,
      install,
      isEnabled,
      isInstalled,
      isPromptPending,
      status: !isEnabled ? 'disabled' : isInstalled ? 'installed' : canInstall ? 'ready' : 'waiting',
    };
  }, [install, installPrompt, isEnabled, isInstalled, isPromptPending]);
}
