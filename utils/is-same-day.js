/**
 This function takes two arguments, d1 and d2.
 If d2 is not defined, it sets it to a new Date().
 Then it returns true if the day, month, and year of d1 and d2 are the same.
 * @param {Date} d1
 * @param {Date} d2
 * @returns {Boolean}
 */
function checkIsSameDay(d1, d2) {
  if(!d2){
    d2 = new Date();
  }
  return d1.getUTCDate() === d2.getUTCDate() && 
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCFullYear() === d2.getUTCFullYear();
}

export default checkIsSameDay;