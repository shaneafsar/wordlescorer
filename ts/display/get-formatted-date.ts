/**
 * 
 * @param {Date} date 
 * @returns {string}
 */
export function getFormattedDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    timeZoneName: 'short',
  };

  return date.toLocaleString('en-US', options);
}
