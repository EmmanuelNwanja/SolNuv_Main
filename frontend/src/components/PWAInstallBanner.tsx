import { useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { RiDownloadLine, RiCloseLine, RiSmartphoneLine } from "react-icons/ri";

export function PWAInstallBanner() {
  const { canPrompt, isInstalled, installApp, dismissPrompt } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!canPrompt || dismissed || isInstalled) return null;

  const handleInstall = async () => {
    setInstalling(true);
    await installApp();
    setInstalling(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    dismissPrompt();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 animate-slide-up">
      <div className="max-w-lg mx-auto bg-forest-900 rounded-2xl p-4 shadow-2xl border border-forest-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <RiSmartphoneLine className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm">Install SolNuv App</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Get quick access, offline support, and a better experience
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={installing}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RiDownloadLine className="w-3.5 h-3.5" />
                {installing ? "Installing..." : "Install"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Dismiss"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
