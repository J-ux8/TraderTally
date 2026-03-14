export const getLocalISOString = (date?: Date) => {
  return (date || new Date()).toISOString();
};
