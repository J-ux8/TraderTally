export const getLocalISOString = (date?: Date) => {
  return (date || new Date()).toISOString();
};

export const toLocalTime = (isoString: string): Date => {
  const date = new Date(isoString);
  return date;
};

export const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday is 0, Monday is 1...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const startOfMonth = (date: Date): Date => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};
