export const formatOrderNumber = (num?: number): string => {
  if (num === undefined) return '---';
  return num.toString().padStart(3, '0');
};
