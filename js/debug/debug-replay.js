// @ts-nocheck
import logError from './log-error.js';

// Useful for debugging a particular tweet
// import debugReplay from './utils/debug-replay.js'
// then run debugReplay(tweetId, T, processTweet)

function debugReplay(tweetId, TClient, processTweet) {
  TClient.get('statuses/show/:id', { 
    id: tweetId, 
    include_ext_alt_text: true 
  })
  .then(({data}) => {
    processTweet(data, false, true);
  })
  .catch(logError);
}

export default debugReplay;