// @returns {String}
function getPercent(num, total) {
  if (num === 0) {
    return '0%';
  }
  var percentNum = Math.round((num / total) * 100);
  if(percentNum === 0) {
    return '<1%';
  }
  return percentNum + '%';
}

export default getPercent;