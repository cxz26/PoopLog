import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCustomTagsStore } from '@/src/core/stores/useCustomTagsStore';
import { CustomTag } from '@/src/core/services/database';

interface CustomTagInputProps {
  category: CustomTag['category'];
  onAdd: (name: string) => void;
}

export const CustomTagInput: React.FC<CustomTagInputProps> = ({ category, onAdd }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [value, setValue] = useState('');
  const { addTag } = useCustomTagsStore();

  const handleAdd = async () => {
    if (value.trim()) {
      await addTag(category, value.trim());
      onAdd(value.trim());
      setValue('');
    }
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="flex items-center gap-2 mt-2 w-full max-w-xs">
        <input 
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') setIsAdding(false);
          }}
          onBlur={handleAdd}
          placeholder="New tag..."
          className="flex-1 bg-surface border border-border-main rounded-full px-4 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
    );
  }

  return (
    <button 
      onClick={() => setIsAdding(true)}
      className="flex items-center gap-1 mt-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
    >
      <Plus size={16} /> Add Custom
    </button>
  );
};
