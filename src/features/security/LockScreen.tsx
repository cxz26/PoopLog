import React, { useState } from 'react';
import { useSecurityStore } from '@/src/core/stores/useSecurityStore';
import { PinPad } from '@/src/shared/components/PinPad';
import { Activity } from 'lucide-react';
import { motion } from 'motion/react';

export const LockScreen: React.FC = () => {
  const { pin, useBiometric, setAuthenticated } = useSecurityStore();
  const [error, setError] = useState<string | null>(null);

  const handlePinEntered = (enteredPin: string) => {
    if (enteredPin === pin) {
      setAuthenticated(true);
    } else {
      setError('Incorrect PIN');
    }
  };

  const handleBiometric = () => {
    // In a real app, we'd use WebAuthn or capacitor biometric API.
    // For now, we simulate success since we are a web app.
    if (window.confirm("Simulate Biometric Authentication Success?")) {
      setAuthenticated(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center pt-24">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-white shadow-xl mb-12"
      >
        <Activity size={40} />
      </motion.div>
      
      <div className="flex-1 w-full flex items-center justify-center">
         <PinPad 
           onPinEntered={handlePinEntered}
           showBiometric={useBiometric}
           onBiometricClick={handleBiometric}
           error={error}
           title="App Locked"
           subtitle="Please authenticate to continue"
         />
      </div>
    </div>
  );
};
