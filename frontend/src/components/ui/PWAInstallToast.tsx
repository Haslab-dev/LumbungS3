import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Download, X, CheckCircle } from 'lucide-react';

export function PWAInstallToast() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent standard browser bar from popping up automatically
      e.preventDefault();
      // Cache the install prompt event for later trigger
      setDeferredPrompt(e);

      // Verify user has not dismissed it recently (cooldown: 24 hours)
      const dismissedTime = localStorage.getItem('pwa_install_dismissed_time');
      const cooldownHours = 24;
      const shouldShow = !dismissedTime || (Date.now() - Number(dismissedTime)) > (cooldownHours * 60 * 60 * 1000);

      if (shouldShow) {
        // Show after a slight delay for better UX
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed');
      setDeferredPrompt(null);
      setIsVisible(false);
      setIsInstalledSuccess(true);
      setTimeout(() => setIsInstalledSuccess(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsVisible(false);
    // Show prompt
    deferredPrompt.prompt();
    
    // Await user decision
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    
    // Clear prompt state
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Save timestamp of dismissal
    localStorage.setItem('pwa_install_dismissed_time', String(Date.now()));
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-[100] glass-card rounded-2xl p-5 border border-indigo-500/20 shadow-2xl flex gap-4 items-start backdrop-blur-2xl bg-slate-900/90"
          >
            {/* Ambient inner glow */}
            <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl pointer-events-none" />

            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Smartphone size={22} />
            </div>

            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-semibold text-white">Install LumbungS3</h4>
              <p className="text-xs text-slate-400 leading-normal">
                Add to your home screen for rapid loading, offline access, and a native app experience.
              </p>
              
              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={handleInstallClick}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Download size={14} />
                  Install App
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-slate-350 transition-colors shrink-0 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification */}
      <AnimatePresence>
        {isInstalledSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[100] bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex gap-3 items-center backdrop-blur-md"
          >
            <CheckCircle className="text-emerald-400 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">App Installed!</p>
              <p className="text-xs text-slate-400 mt-0.5">LumbungS3 is now available on your home screen.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
