import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Trash2, Edit2, Check, X, Tag as TagIcon, Plus } from 'lucide-react';
import { useCustomTagsStore } from '@/src/core/stores/useCustomTagsStore';
import { CustomTag } from '@/src/core/services/database';
import { cn } from '@/src/core/utils/cn';

export const CustomTagsPage: React.FC = () => {
  const navigate = useNavigate();
  const { tags, loadTags, addTag, deleteTag, updateTag } = useCustomTagsStore();
  const [activeCategory, setActiveCategory] = useState<CustomTag['category']>('symptoms');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const filteredTags = useMemo(() => {
    return tags
      .filter(t => t.category === activeCategory)
      .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tags, activeCategory, search]);

  const handleEdit = (tag: CustomTag) => {
    setEditingId(tag.id!);
    setEditValue(tag.name);
  };

  const handleSaveEdit = async () => {
    if (editingId && editValue.trim()) {
      await updateTag(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (newValue.trim()) {
      await addTag(activeCategory, newValue.trim());
    }
    setIsAdding(false);
    setNewValue('');
  };

  const categories = [
    { id: 'symptoms', label: 'Symptoms' },
    { id: 'foods', label: 'Foods' },
    { id: 'medications', label: 'Medications' },
    { id: 'exercise', label: 'Exercise' }
  ] as const;

  return (
    <div className="flex flex-col h-screen bg-background w-full max-w-2xl mx-auto relative overflow-hidden shadow-xl sm:border sm:border-border-main">
      <header className="px-6 py-6 flex items-center justify-between z-10 sticky top-0 bg-background border-b border-border-main/50">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface text-text-main transition-colors">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-xl font-bold">Custom Tags</h1>
        </div>
      </header>

      <div className="px-4 py-4 shrink-0 bg-background z-10">
        <div className="flex bg-surface p-1 rounded-2xl border border-border-main overflow-x-auto no-scrollbar">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap",
                activeCategory === c.id ? "bg-primary text-white" : "text-text-main/60 hover:text-text-main"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 shrink-0">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="w-full bg-surface border border-border-main rounded-2xl pl-12 pr-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-20">
        {isAdding ? (
           <div className="flex items-center gap-2 mb-4 bg-surface p-3 rounded-[16px] border border-border-main">
             <input 
               autoFocus
               value={newValue}
               onChange={e => setNewValue(e.target.value)}
               placeholder="New tag name..."
               className="flex-1 bg-transparent border-none outline-none text-sm font-semibold"
               onKeyDown={e => {
                 if (e.key === 'Enter') handleAdd();
                 if (e.key === 'Escape') setIsAdding(false);
               }}
             />
             <button onClick={handleAdd} className="p-2 text-success hover:bg-success/10 rounded-full"><Check size={18}/></button>
             <button onClick={() => setIsAdding(false)} className="p-2 text-error hover:bg-error/10 rounded-full"><X size={18}/></button>
           </div>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 mb-4 bg-primary/10 text-primary py-3 rounded-[16px] font-bold text-sm hover:bg-primary/20 transition-colors border border-primary/20"
          >
            <Plus size={18} /> Add New Tag
          </button>
        )}

        <div className="space-y-2">
          {filteredTags.length === 0 && !isAdding && (
            <div className="text-center py-12 text-text-main/40">
              <TagIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-semibold">No custom tags found</p>
            </div>
          )}

          {filteredTags.map(tag => (
            <div key={tag.id} className="flex items-center justify-between bg-surface p-4 rounded-[16px] border border-border-main group">
              {editingId === tag.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input 
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="flex-1 bg-background border border-primary/50 rounded-lg px-3 py-1.5 text-sm outline-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button onClick={handleSaveEdit} className="p-1.5 text-success hover:bg-success/10 rounded-lg"><Check size={18}/></button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-text-main/50 hover:bg-black/5 rounded-lg"><X size={18}/></button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-sm">{tag.name}</span>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(tag)} className="p-2 text-text-main/50 hover:text-primary hover:bg-primary/10 rounded-full transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deleteTag(tag.id!)} className="p-2 text-text-main/50 hover:text-error hover:bg-error/10 rounded-full transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
