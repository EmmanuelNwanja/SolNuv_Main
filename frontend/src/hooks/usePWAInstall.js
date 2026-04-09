import { useState, useEffect, useCallback } from 'react';

const INSTALL_PROMPT_KEY = 'solnuv_install_prompt_dismissed';
const INSTALL_PROMPT_DAYS = 7;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://') ||
      window.innerHeight <= 600;

    setIsInstalled(isStandalone);

    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      const dismissed = localStorage.getItem(INSTALL_PROMPT_KEY);
      if (!dismissed) {
        const lastDismissed = localStorage.getItem(`${INSTALL_PROMPT_KEY}_date`);
        if (lastDismissed) {
          const daysSinceDismiss = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
          if (daysSinceDismiss < INSTALL_PROMPT_DAYS) {
            setShowPrompt(false);
            return;
          }
        }
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setShowPrompt(false);
      return true;
    }

    return false;
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem(INSTALL_PROMPT_KEY, 'true');
    localStorage.setItem(`${INSTALL_PROMPT_KEY}_date`, Date.now().toString());
  }, []);

  const canPrompt = useCallback(() => {
    return isInstallable && !isInstalled && showPrompt;
  }, [isInstallable, isInstalled, showPrompt]);

  return {
    isInstallable,
    isInstalled,
    showPrompt,
    canPrompt: canPrompt(),
    installApp,
    dismissPrompt,
  };
}

export default usePWAInstall;
