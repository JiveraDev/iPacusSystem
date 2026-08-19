import PropTypes from 'prop-types';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { usePwaInstallPrompt } from './usePwaInstallPrompt';

export default function PwaInstallButton({ className, variant = 'outline', collapsible = false }) {
  const { canInstall, install, isEnabled, isInstalled, isPromptPending, status } = usePwaInstallPrompt();

  if (!isEnabled || isInstalled || (!canInstall && !isPromptPending)) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={install}
      disabled={!canInstall || isPromptPending}
      className={cn(
        'hidden shrink-0',
        collapsible && 'group w-10 overflow-hidden px-0 transition-[width,padding] duration-300 ease-out hover:w-[8.25rem] hover:px-3 focus-visible:w-[8.25rem] focus-visible:px-3 sm:px-0 sm:hover:px-3 sm:focus-visible:px-3',
        className
      )}
      title={canInstall ? 'Install iPawcus on this device.' : 'Install will be available after the browser validates the PWA.'}
      data-pwa-install-status={status}
    >
      {isPromptPending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Download className="h-4 w-4 shrink-0" />
      )}
      <span className={cn(
        'whitespace-nowrap',
        collapsible && '-ml-2 max-w-0 -translate-x-1 overflow-hidden opacity-0 transition-[margin,max-width,opacity,transform] duration-300 ease-out group-hover:ml-0 group-hover:max-w-24 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:ml-0 group-focus-visible:max-w-24 group-focus-visible:translate-x-0 group-focus-visible:opacity-100'
      )}>
        Install PWA
      </span>
    </Button>
  );
}

PwaInstallButton.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'secondary', 'outline', 'ghost', 'link']),
  collapsible: PropTypes.bool,
};
