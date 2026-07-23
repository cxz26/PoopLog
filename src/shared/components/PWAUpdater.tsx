import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAUpdater: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 bg-surface border border-border-main rounded-2xl shadow-xl p-4 z-50 flex items-center justify-between"
        >
          <div className="flex-1">
            <h3 className="font-bold text-text-main">Update Available</h3>
            <p className="text-sm text-text-main/70">A new version of PoopLog is ready.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setNeedRefresh(false)}
              className="px-4 py-2 text-sm font-semibold text-text-main/60 hover:bg-border-main/20 rounded-xl transition-colors"
            >
              Later
            </button>
            <button 
              onClick={() => updateServiceWorker(true)}
              className="px-4 py-2 text-sm font-bold bg-primary text-white rounded-xl shadow-md flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Download size={16} />
              Update
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
