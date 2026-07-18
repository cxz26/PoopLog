import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Activity, Droplet, Moon, Apple } from 'lucide-react';
import { db, PoopLog } from '@/src/core/services/database';
import { formatDateDisplay } from '@/src/core/utils/date';
import { useLogStore } from '@/src/core/stores/useLogStore';
import { Button } from '@/src/shared/components/Button';
import { SectionCard } from '@/src/shared/components/SectionCard';

export const LogDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deletePoopLog } = useLogStore();
  const [log, setLog] = useState<PoopLog | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      db.poopLogs.get(Number(id)).then(setLog);
    }
  }, [id]);

  if (!log) return null;

  const handleDelete = async () => {
    try {
      await deletePoopLog(log.id!);
      navigate(-1);
    } catch (e) {
      console.error(e);
      // If we had a toast system we'd show it here
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background w-full max-w-2xl mx-auto relative overflow-hidden shadow-xl sm:border sm:border-border-main">
      <header className="px-6 py-6 flex items-center justify-between z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border-main/50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface text-text-main transition-colors">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-xl font-bold text-text-main">Log Details</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6 pb-28">
        {/* Header summary */}
        <div className="text-center pb-2">
          <div className="text-sm font-medium text-text-main/60 uppercase tracking-widest">{formatDateDisplay(log.date)}</div>
          
          {log.hasBowelMovement === false ? (
            <div className="text-3xl font-black text-text-main/60 mt-4 mb-4">No bowel movement</div>
          ) : (
            <>
              <div className="text-5xl font-black text-primary mt-2 mb-4">{log.timeType === 'approximate' ? `${log.timeLabel} (Approx.)` : log.time}</div>
              <div className="inline-flex bg-primary/10 text-primary px-4 py-2 rounded-full font-bold">
                Bristol Type {log.bristolType}
              </div>
              {log.confidence && (
                <div className="mt-3 text-sm text-text-main/50 font-medium tracking-wide">
                  Memory: {log.confidence}
                </div>
              )}
            </>
          )}
        </div>

        {/* Overview */}
        {log.hasBowelMovement !== false && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface p-4 rounded-[20px] border border-border-main text-center">
              <div className="text-xs text-text-main/50 uppercase font-bold mb-1">Amount</div>
              <div className="font-semibold text-xl">{log.amount === 'Not Sure' ? '≈ Estimated' : log.amount}</div>
            </div>
            <div className="bg-surface p-4 rounded-[20px] border border-border-main text-center">
              <div className="text-xs text-text-main/50 uppercase font-bold mb-1">Difficulty</div>
              <div className="font-semibold text-xl">{log.difficulty === 'Not Sure' ? '≈ Estimated' : log.difficulty}</div>
            </div>
            <div className="bg-surface p-4 rounded-[20px] border border-border-main text-center">
              <div className="text-xs text-text-main/50 uppercase font-bold mb-1">Color</div>
              <div className="font-semibold text-xl">{log.color === 'Not Sure' ? '≈ Estimated' : log.color}</div>
            </div>
            <div className="bg-surface p-4 rounded-[20px] border border-border-main text-center">
              <div className="text-xs text-text-main/50 uppercase font-bold mb-1">Pain Level</div>
              <div className="font-semibold text-xl">{log.pain === 'Not Sure' ? '≈ Estimated' : `${log.pain}/10`}</div>
            </div>
          </div>
        )}

        {/* Symptoms */}
        {log.symptoms && log.symptoms.length > 0 && (
          <SectionCard className="p-6 md:p-6" title="Symptoms">
            <div className="flex flex-wrap gap-2">
              {log.symptoms.map(s => <span key={s} className="bg-danger/10 text-danger border border-danger/20 px-3 py-1.5 rounded-full text-sm font-semibold">{s}</span>)}
            </div>
          </SectionCard>
        )}

        {/* Factors */}
        {(log.foods?.length || log.medications?.length || log.exercise?.length) ? (
          <SectionCard className="p-6 md:p-6 space-y-6" title="Factors">
            {log.foods && log.foods.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-text-main/50 uppercase tracking-widest mb-3 flex items-center gap-2"><Apple size={16}/> Food</h4>
                <div className="flex flex-wrap gap-2">
                  {log.foods.map(f => <span key={f} className="bg-warning/10 text-warning border border-warning/20 px-3 py-1.5 rounded-full text-sm font-semibold">{f}</span>)}
                </div>
              </div>
            )}
            {log.medications && log.medications.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-text-main/50 uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={16}/> Medication</h4>
                <div className="flex flex-wrap gap-2">
                  {log.medications.map(m => <span key={m} className="bg-success/10 text-success border border-success/20 px-3 py-1.5 rounded-full text-sm font-semibold">{m}</span>)}
                </div>
              </div>
            )}
            {log.exercise && log.exercise.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-text-main/50 uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={16}/> Exercise</h4>
                <div className="flex flex-wrap gap-2">
                  {log.exercise.map(e => <span key={e} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-sm font-semibold">{e}</span>)}
                </div>
              </div>
            )}
          </SectionCard>
        ) : null}

        {/* Wellness */}
        <SectionCard className="p-6 md:p-6" title="Wellness">
          <div className="flex divide-x divide-border-main">
             <div className="flex-1 text-center pr-4">
               <div className="flex justify-center text-primary/50 mb-2"><Moon size={24}/></div>
               <div className="text-sm text-text-main/60 font-semibold mb-1">Sleep</div>
               <div className="font-bold">
                 {log.sleepType === 'simple' ? log.sleepSimple : (
                   log.sleepDurationMinutes ? `${Math.floor(log.sleepDurationMinutes / 60)} hr ${log.sleepDurationMinutes % 60} min` : `${log.sleepHours || 0}h`
                 )} 
                 {log.sleepQuality && log.sleepQuality !== 'Not Sure' && log.sleepType === 'exact' ? ` (${log.sleepQuality})` : ''}
               </div>
             </div>
             <div className="flex-1 text-center pl-4">
               <div className="flex justify-center text-primary/50 mb-2"><Droplet size={24}/></div>
               <div className="text-sm text-text-main/60 font-semibold mb-1">Water</div>
               <div className="font-bold">
                 {log.waterType === 'simple' ? log.waterSimple : (
                   log.waterDetailed !== undefined ? `${log.waterDetailed} ${log.waterUnit || 'mL'}` : `${log.water || 0} Cups`
                 )}
               </div>
             </div>
          </div>
        </SectionCard>

        {/* Notes */}
        {log.notes && (
          <SectionCard className="p-6 md:p-6" title="Notes">
            <p className="text-text-main/80 whitespace-pre-wrap">{log.notes}</p>
          </SectionCard>
        )}

      </main>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent flex gap-4">
        <Button 
          variant="outlined" 
          className="flex-1 bg-surface border-error text-error hover:bg-error/10" 
          leftIcon={<Trash2 size={18} />} 
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete
        </Button>
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-background rounded-[24px] p-6 w-full max-w-sm shadow-2xl border border-border-main" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Delete this record?</h3>
            <p className="text-text-main/60 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outlined" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-error text-white border-error" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
