import PropTypes from 'prop-types';
import { CheckCircle2, Download, Loader2 } from 'lucide-react';

import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { usePwaInstallPrompt } from './usePwaInstallPrompt';

export default function PwaInstallButton({ className, variant = 'outline' }) {
  const { canInstall, install, isEnabled, isInstalled, isPromptPending, status } = usePwaInstallPrompt();

  if (!isEnabled) {
    return null;
  }

  if (isInstalled) {
    return (
      <Button
        type="button"
        variant={variant}
        disabled
        className={cn('shrink-0', className)}
        data-pwa-install-status={status}
      >
        <CheckCircle2 className="h-4 w-4" />
        Installed
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={install}
      disabled={!canInstall || isPromptPending}
      className={cn('shrink-0', className)}
      title={canInstall ? 'Install iPawcus on this device.' : 'Install will be available after the browser validates the PWA.'}
      data-pwa-install-status={status}
    >
      {isPromptPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Install App
    </Button>
  );
}

PwaInstallButton.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'secondary', 'outline', 'ghost', 'link']),
};
