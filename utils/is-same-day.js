/**
 This function takes two arguments, d1 and d2.
 If d2 is not defined, it sets it to a new Date().
 Then it returns true if the day, month, and year of d1 and d2 are the same.
 * @param {Date|string} d1
 * @param {Date} [d2]
 * @returns {Boolean}
 */
function checkIsSameDay(d1, d2 = new Date()) {
  if (typeof d1 === 'string') {
    d1 = new Date(d1);
  }
  return d1.getUTCDate() === d2.getUTCDate() && 
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCFullYear() === d2.getUTCFullYear();
}

export default checkIsSameDay;