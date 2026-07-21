import React, { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';
import { motion } from 'motion/react';

interface PinPadProps {
  onPinEntered: (pin: string) => void;
  error?: string | null;
  title?: string;
  subtitle?: string;
}

export const PinPad: React.FC<PinPadProps> = ({ 
  onPinEntered, 
  error,
  title = "Enter PIN",
  subtitle = "Please enter your 4-digit PIN"
}) => {
  const [pin, setPin] = useState<string>('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length === 4) {
      onPinEntered(pin);
    }
  }, [pin, onPinEntered]);

  useEffect(() => {
    if (error) {
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + key);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto h-full px-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 text-text-main">{title}</h2>
        <p className="text-text-main/60">{subtitle}</p>
      </div>

      {/* Dots */}
      <motion.div 
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-12"
      >
        {[0, 1, 2, 3].map(i => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-primary' : 'bg-border-main'}`} 
          />
        ))}
      </motion.div>

      {/* Error Message */}
      <div className="h-6 mb-4 text-danger font-medium text-sm text-center">
        {error}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-6 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="w-16 h-16 rounded-full bg-surface border border-border-main text-2xl font-bold flex items-center justify-center hover:bg-border-main/50 transition-colors mx-auto"
          >
            {num}
          </button>
        ))}
        
        <div />
        
        <button
          onClick={() => handleKeyPress('0')}
          className="w-16 h-16 rounded-full bg-surface border border-border-main text-2xl font-bold flex items-center justify-center hover:bg-border-main/50 transition-colors mx-auto"
        >
          0
        </button>
        
        <div className="flex items-center justify-center">
          <button
            onClick={handleDelete}
            aria-label="Delete PIN digit"
            className="w-16 h-16 rounded-full flex items-center justify-center text-text-main hover:bg-border-main/50 transition-colors"
          >
            <Delete size={28} />
          </button>
        </div>
      </div>
    </div>
  );
};
