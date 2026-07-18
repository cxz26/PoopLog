import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/src/core/utils/cn';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/src/shared/components/Button';
import { ChoiceCard } from '@/src/shared/components/ChoiceCard';
import { Chip } from '@/src/shared/components/Chip';
import { SliderCard } from '@/src/shared/components/SliderCard';
import { getTodayDateString, getCurrentTimeString } from '@/src/core/utils/date';
import { useLogStore } from '@/src/core/stores/useLogStore';
import { PoopLog } from '@/src/core/services/database';
import { useCustomTagsStore } from '@/src/core/stores/useCustomTagsStore';
import { useSettingsStore } from '@/src/core/stores/useSettingsStore';
import { CustomTagInput } from './CustomTagInput';

const BRISTOL_TYPES = [
  { type: 1, desc: 'Separate hard lumps, like nuts' },
  { type: 2, desc: 'Sausage-shaped but lumpy' },
  { type: 3, desc: 'Like a sausage but with cracks' },
  { type: 4, desc: 'Like a sausage, smooth and soft' },
  { type: 5, desc: 'Soft blobs with clear-cut edges' },
  { type: 6, desc: 'Fluffy pieces with ragged edges' },
  { type: 7, desc: 'Watery, no solid pieces' },
];

const COLORS = [
  { label: 'Brown', value: 'Brown', hex: '#654321' },
  { label: 'Dark Brown', value: 'Dark Brown', hex: '#3b2512' },
  { label: 'Light Brown', value: 'Light Brown', hex: '#c49a6c' },
  { label: 'Yellow', value: 'Yellow', hex: '#d4b84b' },
  { label: 'Green', value: 'Green', hex: '#487c3b' },
  { label: 'Black', value: 'Black', hex: '#1a1a1a' },
  { label: 'Red', value: 'Red', hex: '#b03030' },
  { label: 'White', value: 'White', hex: '#e6e6e6' },
  { label: 'Not Sure', value: 'Not Sure', hex: '#9ca3af' },
  { label: 'Skipped', value: 'Skipped', hex: '#e5e7eb' },
];

const SYMPTOMS = ['Abdominal Pain', 'Bloating', 'Blood', 'Mucus', 'Urgency', 'Incomplete Evacuation', 'Gas', "I don't remember"];
const FOODS = ['Coffee', 'Alcohol', 'Spicy Food', 'Milk', 'Fast Food', 'BBQ', 'High Fiber', 'Not Sure', 'None'];
const MEDS = ['Antibiotics', 'Probiotics', 'Laxatives', 'Painkillers', 'Not Sure', 'None', 'Skipped'];
const EXERCISES = ['Gym', 'Walking', 'Running', 'Basketball', 'Cycling', 'Swimming', 'Yoga', 'Not Sure', 'None'];
const APPROX_TIMES = ['Early Morning', 'Morning', 'Late Morning', 'Afternoon', 'Evening', 'Night', 'Late Night'];
const CONFIDENCES = ['Very Accurate', 'Mostly Remember', 'Rough Estimate', 'Not Sure'];

export const NewLogFlow: React.FC = () => {
  const navigate = useNavigate();
  const { savePoopLog } = useLogStore();
  const { tags, loadTags } = useCustomTagsStore();
  const { preferredWaterUnit } = useSettingsStore();
  
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const customSymptoms = useMemo(() => tags.filter(t => t.category === 'symptoms').map(t => t.name), [tags]);
  const customFoods = useMemo(() => tags.filter(t => t.category === 'foods').map(t => t.name), [tags]);
  const customMeds = useMemo(() => tags.filter(t => t.category === 'medications').map(t => t.name), [tags]);
  const customExercises = useMemo(() => tags.filter(t => t.category === 'exercise').map(t => t.name), [tags]);

  const allSymptoms = useMemo(() => [...new Set([...SYMPTOMS, ...customSymptoms])], [customSymptoms]);
  const allFoods = useMemo(() => [...new Set([...FOODS, ...customFoods])], [customFoods]);
  const allMeds = useMemo(() => [...new Set([...MEDS, ...customMeds])], [customMeds]);
  const allExercises = useMemo(() => [...new Set([...EXERCISES, ...customExercises])], [customExercises]);

  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const totalSteps = 12;

  // View States
  const [timeMode, setTimeMode] = useState<'exact' | 'approx'>('approx');
  const [showAdvancedSleep, setShowAdvancedSleep] = useState(false);
  const [showAdvancedWater, setShowAdvancedWater] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<PoopLog>>({
    date: getTodayDateString(),
    time: getCurrentTimeString(),
    timeType: 'approximate',
    timeLabel: 'Morning',
    confidence: 'Mostly Remember',
    bristolType: undefined,
    amount: undefined,
    difficulty: undefined,
    pain: 'Not Sure',
    symptoms: [],
    color: '',
    foods: [],
    medications: [],
    exercise: [],
    sleepType: 'simple',
    sleepSimple: 'Not Sure',
    sleepDurationMinutes: 0,
    waterType: 'simple',
    waterSimple: 'Not Sure',
    waterDetailed: 0,
    waterUnit: preferredWaterUnit,
    notes: ''
  });

  const updateForm = (updates: Partial<PoopLog>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSave = async () => {
    if (!formData.bristolType || !formData.amount || !formData.difficulty || !formData.color) {
      alert("Please fill in the recommended fields (Time, Bristol, Amount, Difficulty, Color). You can select 'Not Sure' if you don't remember.");
      return;
    }
    
    const dataToSave = { ...formData } as any;
    
    // Normalize water to mL before saving
    if (dataToSave.waterType === 'exact' && dataToSave.waterDetailed) {
      if (dataToSave.waterUnit === 'mL') dataToSave.waterML = dataToSave.waterDetailed;
      else if (dataToSave.waterUnit === 'L') dataToSave.waterML = dataToSave.waterDetailed * 1000;
      else if (dataToSave.waterUnit === 'Cups') dataToSave.waterML = dataToSave.waterDetailed * 250;
    }

    await savePoopLog(dataToSave as Omit<PoopLog, 'id'|'createdAt'|'updatedAt'>);
    setIsSuccess(true);
    setTimeout(() => {
      navigate('/');
    }, 1500);
  };

  const toggleArrayItem = (key: keyof PoopLog, item: string) => {
    setFormData(prev => {
      const arr = (prev[key] as string[]) || [];
      if (item === 'None' || item === "I don't remember" || item === 'Not Sure' || item === 'Skipped') {
        return { ...prev, [key]: [item] };
      }
      const newArr = arr.filter(i => i !== 'None' && i !== "I don't remember" && i !== 'Not Sure' && i !== 'Skipped');
      return {
        ...prev,
        [key]: newArr.includes(item) ? newArr.filter(i => i !== item) : [...newArr, item]
      };
    });
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">When was it?</h2>
            
            <div className="flex bg-surface p-1 rounded-2xl border border-border-main mb-6">
              <button 
                className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors", timeMode === 'approx' ? "bg-primary text-white" : "text-text-main/60")}
                onClick={() => { setTimeMode('approx'); updateForm({ timeType: 'approximate' }); }}
              >
                Approximate
              </button>
              <button 
                className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors", timeMode === 'exact' ? "bg-primary text-white" : "text-text-main/60")}
                onClick={() => { setTimeMode('exact'); updateForm({ timeType: 'exact' }); }}
              >
                Exact Time
              </button>
            </div>

            {timeMode === 'exact' ? (
              <div className="bg-surface p-6 rounded-[24px] border border-border-main">
                <input 
                  type="time" 
                  value={formData.time} 
                  onChange={e => updateForm({ time: e.target.value })}
                  className="w-full bg-transparent text-4xl font-bold text-center outline-none text-primary"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {APPROX_TIMES.map(t => (
                  <ChoiceCard 
                    key={t}
                    title={t}
                    selected={formData.timeLabel === t}
                    onClick={() => updateForm({ timeLabel: t })}
                  />
                ))}
              </div>
            )}
            
            <div className="pt-4 border-t border-border-main mt-4">
               <h3 className="text-sm font-bold text-text-main/60 mb-3">How well do you remember? (Optional)</h3>
               <div className="grid grid-cols-2 gap-2">
                 {CONFIDENCES.map(c => (
                   <Chip 
                     key={c} 
                     label={c} 
                     selected={formData.confidence === c}
                     onClick={() => updateForm({ confidence: c as any })}
                     className="justify-center"
                   />
                 ))}
               </div>
            </div>

            <Button className="w-full mt-4" onClick={nextStep}>Next</Button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Bristol Stool Scale</h2>
            <div className="grid grid-cols-1 gap-3">
              {BRISTOL_TYPES.map(t => (
                <ChoiceCard 
                  key={t.type}
                  title={`Type ${t.type}`}
                  description={t.desc}
                  selected={formData.bristolType === t.type}
                  onClick={() => { updateForm({ bristolType: t.type }); nextStep(); }}
                />
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Amount</h2>
            <div className="grid grid-cols-1 gap-4">
              {(['Small', 'Medium', 'Large', 'Not Sure'] as const).map(amt => (
                <ChoiceCard 
                  key={amt}
                  title={amt}
                  selected={formData.amount === amt}
                  onClick={() => { updateForm({ amount: amt }); nextStep(); }}
                />
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Difficulty</h2>
            <div className="grid grid-cols-1 gap-3">
              {(['Easy', 'Normal', 'Hard', 'Not Sure'] as const).map(diff => (
                <ChoiceCard 
                  key={diff}
                  title={diff}
                  selected={formData.difficulty === diff}
                  onClick={() => { updateForm({ difficulty: diff }); nextStep(); }}
                />
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Color</h2>
            <div className="grid grid-cols-2 gap-4">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => { updateForm({ color: c.value }); nextStep(); }}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-[20px] border-2 transition-all",
                    formData.color === c.value ? "border-primary bg-primary/5" : "border-border-main bg-surface hover:border-primary/30"
                  )}
                >
                  <div className="w-8 h-8 rounded-full border border-black/10 shadow-inner flex-shrink-0" style={{ backgroundColor: c.hex }} />
                  <span className="font-semibold text-sm leading-tight text-left">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Pain Level</h2>
            <p className="text-text-main/60">You can skip this if you're unsure.</p>
            
            <div className="flex gap-2 mb-6">
              <ChoiceCard 
                title="Not Sure" 
                selected={formData.pain === 'Not Sure'} 
                onClick={() => updateForm({ pain: 'Not Sure' })} 
                className="flex-1"
              />
              <ChoiceCard 
                title="Select Pain" 
                selected={formData.pain !== 'Not Sure'} 
                onClick={() => updateForm({ pain: 0 })}
                className="flex-1"
              />
            </div>

            {formData.pain !== 'Not Sure' && (
              <SliderCard 
                label="Pain" 
                value={formData.pain as number || 0} 
                onChange={v => updateForm({ pain: v })} 
                max={10} 
              />
            )}
            <Button className="w-full" onClick={nextStep}>Next</Button>
          </div>
        );
      case 7:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Symptoms</h2>
            <p className="text-text-main/60">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {allSymptoms.map(sym => (
                <Chip 
                  key={sym} 
                  label={sym} 
                  selected={formData.symptoms?.includes(sym)}
                  onClick={() => toggleArrayItem('symptoms', sym)}
                />
              ))}
            </div>
            <CustomTagInput category="symptoms" onAdd={(name) => toggleArrayItem('symptoms', name)} />
            <Button className="w-full mt-6" onClick={nextStep}>Next</Button>
          </div>
        );
      case 8:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Diet & Health</h2>
            <p className="text-text-main/60">Anything that might have affected today's bowel movement?</p>
            
            <h3 className="font-bold mt-4 mb-2 text-sm text-text-main/80">Food</h3>
            <div className="flex flex-wrap gap-2">
              {allFoods.map(f => (
                <Chip key={f} label={f} selected={formData.foods?.includes(f)} onClick={() => toggleArrayItem('foods', f)} />
              ))}
            </div>
            <CustomTagInput category="foods" onAdd={(name) => toggleArrayItem('foods', name)} />

            <h3 className="font-bold mt-4 mb-2 text-sm text-text-main/80">Medication</h3>
            <div className="flex flex-wrap gap-2">
              {allMeds.map(m => (
                <Chip key={m} label={m} selected={formData.medications?.includes(m)} onClick={() => toggleArrayItem('medications', m)} />
              ))}
            </div>
            <CustomTagInput category="medications" onAdd={(name) => toggleArrayItem('medications', name)} />

            <h3 className="font-bold mt-4 mb-2 text-sm text-text-main/80">Exercise</h3>
            <div className="flex flex-wrap gap-2">
              {allExercises.map(e => (
                <Chip key={e} label={e} selected={formData.exercise?.includes(e)} onClick={() => toggleArrayItem('exercise', e)} />
              ))}
            </div>
            <CustomTagInput category="exercise" onAdd={(name) => toggleArrayItem('exercise', name)} />

            <Button className="w-full mt-6" onClick={nextStep}>Next</Button>
          </div>
        );
      case 9:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Sleep</h2>
            <p className="text-text-main/60">You can always add more later.</p>

            {!showAdvancedSleep ? (
              <div className="grid grid-cols-2 gap-3">
                {(['Less than 5 hours', '5–7 hours', '7–9 hours', 'More than 9 hours', 'Not Sure'] as const).map(q => (
                  <ChoiceCard 
                    key={q} 
                    title={q} 
                    selected={formData.sleepSimple === q} 
                    onClick={() => { updateForm({ sleepType: 'simple', sleepSimple: q }); }} 
                  />
                ))}
                <div className="col-span-2 mt-2">
                  <Button variant="secondary" className="w-full" onClick={() => setShowAdvancedSleep(true)}>Expand Details</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                   <h4 className="font-semibold mb-3">Duration (Hours & Minutes)</h4>
                   <div className="flex gap-4">
                     <div className="flex-1">
                       <label className="text-xs font-bold text-text-main/60 uppercase">Hours</label>
                       <input 
                         type="number" min="0" max="24"
                         value={Math.floor((formData.sleepDurationMinutes || 0) / 60)}
                         onChange={e => {
                           const h = parseInt(e.target.value) || 0;
                           const m = (formData.sleepDurationMinutes || 0) % 60;
                           updateForm({ sleepType: 'exact', sleepDurationMinutes: h * 60 + m });
                         }}
                         className="w-full bg-surface border border-border-main rounded-xl px-4 py-3 text-lg font-bold text-primary mt-1"
                       />
                     </div>
                     <div className="flex-1">
                       <label className="text-xs font-bold text-text-main/60 uppercase">Minutes</label>
                       <input 
                         type="number" min="0" max="59"
                         value={(formData.sleepDurationMinutes || 0) % 60}
                         onChange={e => {
                           const m = parseInt(e.target.value) || 0;
                           const h = Math.floor((formData.sleepDurationMinutes || 0) / 60);
                           updateForm({ sleepType: 'exact', sleepDurationMinutes: h * 60 + m });
                         }}
                         className="w-full bg-surface border border-border-main rounded-xl px-4 py-3 text-lg font-bold text-primary mt-1"
                       />
                     </div>
                   </div>
                </div>
                <div>
                   <h4 className="font-semibold mb-3">Quality</h4>
                   <div className="flex gap-2">
                     {(['Poor', 'Average', 'Good', 'Excellent'] as const).map(q => (
                       <Chip key={q} label={q} selected={formData.sleepQuality === q} onClick={() => updateForm({ sleepQuality: q })} className="flex-1 text-center justify-center px-1" />
                     ))}
                   </div>
                </div>
                <Button variant="secondary" className="w-full" onClick={() => setShowAdvancedSleep(false)}>Back to Simple</Button>
              </div>
            )}
            
            <Button className="w-full mt-4" onClick={nextStep}>Next</Button>
          </div>
        );
      case 10:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Water Intake</h2>
            <p className="text-text-main/60">You can skip this if you're unsure.</p>

            {!showAdvancedWater ? (
              <div className="grid grid-cols-2 gap-3">
                {(['Very Little', 'Some', 'Enough', 'A Lot', 'Not Sure'] as const).map(q => (
                  <ChoiceCard 
                    key={q} 
                    title={q} 
                    selected={formData.waterSimple === q} 
                    onClick={() => updateForm({ waterType: 'simple', waterSimple: q })} 
                  />
                ))}
                <div className="col-span-2 mt-2">
                  <Button variant="secondary" className="w-full" onClick={() => setShowAdvancedWater(true)}>Expand to exact cups</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex bg-surface p-1 rounded-2xl border border-border-main mb-4">
                  {(['mL', 'L', 'Cups'] as const).map(u => (
                     <button 
                       key={u}
                       className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors", formData.waterUnit === u ? "bg-primary text-white" : "text-text-main/60")}
                       onClick={() => updateForm({ waterUnit: u, waterType: 'exact' })}
                     >
                       {u}
                     </button>
                  ))}
                </div>
                <div className="bg-surface border border-border-main rounded-xl p-4 flex items-center justify-between">
                  <input 
                    type="number" 
                    min="0" step={formData.waterUnit === 'L' ? 0.1 : 1}
                    value={formData.waterDetailed || ''}
                    onChange={e => updateForm({ waterDetailed: parseFloat(e.target.value) || 0, waterType: 'exact' })}
                    className="w-full bg-transparent text-3xl font-bold outline-none text-primary"
                    placeholder="0"
                  />
                  <span className="font-bold text-text-main/60">{formData.waterUnit}</span>
                </div>
                <Button variant="secondary" className="w-full mt-2" onClick={() => setShowAdvancedWater(false)}>Back to Simple</Button>
              </div>
            )}

            <Button className="w-full mt-4" onClick={nextStep}>Next</Button>
          </div>
        );
      case 11:
        return (
          <div className="space-y-6 flex flex-col h-full">
            <h2 className="text-3xl font-bold">Notes</h2>
            <textarea 
              value={formData.notes}
              onChange={e => updateForm({ notes: e.target.value })}
              maxLength={500}
              placeholder="Any additional notes..."
              className="flex-1 bg-surface border border-border-main rounded-[24px] p-6 text-lg outline-none focus:border-primary resize-none min-h-[200px]"
            />
            <Button className="w-full mt-4" onClick={handleSave}>Save Log</Button>
          </div>
        );
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center text-center p-6 w-full max-w-2xl mx-auto relative overflow-hidden shadow-xl sm:border sm:border-border-main">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-success text-white p-8 rounded-full mb-6"
        >
          <CheckCircle2 size={64} />
        </motion.div>
        <h2 className="text-3xl font-bold mb-2">Saved Successfully</h2>
        <p className="text-text-main/70">Your log has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background w-full max-w-2xl mx-auto relative overflow-hidden shadow-xl sm:border sm:border-border-main">
      <header className="px-6 py-6 flex items-center justify-between z-10 sticky top-0 bg-background">
        <button onClick={step === 1 ? () => navigate(-1) : prevStep} className="p-2 -ml-2 rounded-full hover:bg-surface text-text-main transition-colors">
          <ChevronLeft size={28} />
        </button>
        <div className="flex gap-1.5 flex-1 mx-6">
          {Array.from({ length: totalSteps - 1 }).map((_, i) => (
            <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i + 1 <= step ? "bg-primary" : "bg-primary/20")} />
          ))}
        </div>
        <div className="text-sm font-bold text-primary w-8 text-right">{step}/{totalSteps - 1}</div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
