import COMPLIMENTS from '../const/COMPLIMENTS.js';

/**
 * Returns a compliment.
 * TODO: Consider adjusting to different ones based on score?
 * @param {boolean} [isGrowthTweet=false]
 * @returns {string} a compliment :)
 */
export function getCompliment(isGrowthTweet: boolean = false) {
  const length = COMPLIMENTS.length;
  return COMPLIMENTS[Math.floor(Math.random() * length)] + (isGrowthTweet ? ' Mention me in the future, I <3 wordles!' : '');
}