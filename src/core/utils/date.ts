export const getTodayDateString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const getCurrentTimeString = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  return format(parseISO(dateStr), 'EEEE, MMM d');
};
import { format, parseISO } from 'date-fns';
