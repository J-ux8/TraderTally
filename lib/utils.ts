export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return 'K 0.00';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format with commas and 2 decimal places (e.g. 1,500.00)
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${isNegative ? '-' : ''}K ${formatted}`;
}
