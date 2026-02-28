import COMPLIMENTS from '../const/COMPLIMENTS';

export function getCompliment(isGrowthTweet: boolean = false) {
  const length = COMPLIMENTS.length;
  return COMPLIMENTS[Math.floor(Math.random() * length)] + (isGrowthTweet ? ' Mention me in the future, I <3 wordles!' : '');
}
