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

/**
 * Generates a unique branch name by appending a random 6-character alphanumeric suffix.
 * Useful for test setup where a fresh, collision-free branch name is needed.
 *
 * @param prefix The branch name prefix (e.g. 'merge-test', 'branch-restore-test')
 * @returns A unique branch name like `merge-test-a1b2c3`
 */
export function generateUniqueBranchName(prefix: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${randomSuffix}`;
}
