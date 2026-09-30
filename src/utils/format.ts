export const formatOrderNumber = (num?: number): string => {
  if (num === undefined || isNaN(num)) return '0001';
  return num.toString().padStart(4, '0');
};
