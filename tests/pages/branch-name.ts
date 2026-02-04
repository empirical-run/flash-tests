/**
 * Helper function to construct branch name for a given date
 * @param date The date to generate the branch name for
 * @returns Branch name in format `feat/{month}-{day}-{year}` (e.g., `feat/jan-28-2026`)
 */
export function getBranchNameForDate(date: Date): string {
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `feat/${month}-${day}-${year}`;
}

/**
 * Get branch name for today's date
 * @returns Branch name for current date
 */
export function getTodaysBranchName(): string {
  return getBranchNameForDate(new Date());
}
