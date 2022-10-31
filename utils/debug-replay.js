import logError from './log-error.js';

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