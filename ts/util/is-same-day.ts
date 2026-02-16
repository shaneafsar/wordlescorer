/**
 * Returns true if the day, month, and year of d1 and d2 are the same (UTC).
 */
function checkIsSameDay(d1: Date | string, d2: Date = new Date()): boolean {
  if (typeof d1 === 'string') {
    d1 = new Date(d1);
  }
  return d1.getUTCDate() === d2.getUTCDate() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCFullYear() === d2.getUTCFullYear();
}

export default checkIsSameDay;
