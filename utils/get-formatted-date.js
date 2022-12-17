export function getFormattedDate(date) {
  let options = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  options.timeZone = 'UTC';
  options.timeZoneName = 'short';

  return date.toLocaleString('en-US', options);
}
