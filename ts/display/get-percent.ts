function getPercent(num: number, total: number): string {
  if (num === 0) {
    return '0%';
  }
  const percentNum = Math.round((num / total) * 100);
  if (percentNum === 0) {
    return '<1%';
  }
  return percentNum + '%';
}

export default getPercent;