import { createQueue } from "@taskless/express";
import logConsole from '../../js/debug/log-console.js';
import getTopScorerInfo from '../../js/db/get-top-scorer-info.js';
import { getFormattedDate } from '../../js/display/get-formatted-date.js';
import { getCompliment } from '../../js/display/get-compliment.js';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

/** Describes our queue object **/
type Score = {
  scoreDate: Date;
};

export default createQueue<Score>(
  "score", // 👈🏼 The name of this queue, URL safe and up to 100 characters
  "/score/", // 👈🏼 The URL path this queue is reachable on
  async (job) => {
    // 👇🏻 When your job executes, this is what runs
            const scorer = await getTopScorerInfo(job.scoreDate);
        
        if (scorer) {
            const formattedDate = getFormattedDate(job.scoreDate);
            const scorerAppend = `They scored ${scorer.score} points for #Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;
            const scorerNameOnly = `${scorer.screenName}!`;
            const finalStatus = `The top scorer for ${formattedDate} is: ${scorerNameOnly} ${scorerAppend}`;

            // Send a separate status for mastodon. 
            // If the winner is from twitter, need to append @twitter.com to the username.
            const mastodonStatus = scorer.source !== 'mastodon' ? 
            `The top scorer for ${formattedDate} is: ${scorer.screenName}@twitter.com! ${scorerAppend}` : 
            finalStatus;

            /*if(!IS_DEVELOPMENT) {
                this.TOAuthV1Client.v2.tweet(finalStatus);
                this.MClient?.v1.statuses.create({ status: mastodonStatus });
            }*/
            logConsole(`Daily top score ${IS_DEVELOPMENT? 'DEVMODE' : ''} Masto | ${mastodonStatus}`);
        } else {
            logConsole(`No top scorer found today`);
        }
  }
);