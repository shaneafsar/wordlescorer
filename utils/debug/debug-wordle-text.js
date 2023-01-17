import getWordleMatrixFromText from "../extract/get-wordle-matrix-from-text.js";
import { calculateScoreFromWordleMatrix } from "../calculate/calculate-score-from-wordle-matrix.js";
import { getSolvedRow } from "../calculate/get-solved-row.js";
import { getWordleNumberFromText } from "../extract/get-wordle-number-from-text.js";
import getTopScorerInfo from "../db/get-top-scorer-info.js";
import Twit from "twit";
import dotenv from 'dotenv';
import { getCompliment } from "../display/get-compliment.js";
import getWordleMatrixFromImageAltText from "../extract/get-wordle-matrix-from-image-alt-text.js";
import isValidWordle from "../calculate/is-valid-wordle.js";
import { TwitterApi } from 'twitter-api-v2';

dotenv.config({path: '../../.env'});

const twitterClient = new Twit({
    consumer_key: process.env['consumer_key'],
    consumer_secret: process.env['consumer_secret'],
    access_token: process.env['access_token'],
    access_token_secret: process.env['access_token_secret'],
  });

const newTwitterApi = new TwitterApi(process.env['bearer_token']);

//tweet_mode: 'extended'
  twitterClient.get('statuses/show/:id', {id: '1608040651546836995', include_ext_alt_text: true, tweet_mode: 'extended'}).then(({data}) => {
    
    var parentAltText = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
    console.log(data.text || data.full_text);
    var wordleResult = getWordleMatrixFromText(data.text || data.full_text);
    var WordleAlt = getWordleMatrixFromImageAltText(parentAltText);
    console.log('isValidWordle ', isValidWordle(wordleResult));

    const wordleNumber = getWordleNumberFromText(data.full_text);

    const score = calculateScoreFromWordleMatrix(wordleResult).finalScore;
    const solvedRow = getSolvedRow(wordleResult);
    const solvedRowAlt = getSolvedRow(WordleAlt);
  
    console.log('wordleResult ', wordleResult);
    console.log('WordleAlt ', WordleAlt);
    console.log('wordleNum ', wordleNumber);
    console.log('score ', score);
    console.log('solvedRow ', solvedRow);
    console.log('solvedRowAlt ', solvedRowAlt);

  });

  newTwitterApi.v2.tweets('1608040651546836995', {
    'tweet.fields': ['attachments', 'author_id','created_at','id','in_reply_to_user_id','text','referenced_tweets'],
    'media.fields': ['alt_text'],
    'user.fields': ['id', 'username','profile_image_url'],
    expansions: ['attachments.media_keys','author_id', 'in_reply_to_user_id', 'referenced_tweets.id'],
  }).then(val => {
    console.log('v2 API ', val);
  })

async function getTopScorerConsole() {
    var date = new Date('12-28-2022');
    var scorer = await getTopScorerInfo(date);
    var finalStatus = `${scorer.name}! They scored ${scorer.score} points for Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;


    console.log(`The top scorer for ${getFormattedDate(date)} is: ${finalStatus}`);
}


const tweetText = `I changed my phone yesterday and have lost my run of 296 wordles. Upsetting. Anyway: Wordle 557 5/6

 ⬛⬛⬛⬛🟨
 🟨🟨⬛⬛⬛
 ⬛⬛🟨🟩⬛
 🟨🟨⬛🟩⬛
 🟩🟩🟩🟩🟩
 
 @ScoreMyWordle`;

const wordleResult = getWordleMatrixFromText(tweetText);
const wordleNumber = getWordleNumberFromText(tweetText);

const score = calculateScoreFromWordleMatrix(wordleResult).finalScore;
const solvedRow = getSolvedRow(wordleResult);


console.log(wordleResult);
console.log(wordleNumber);
console.log(score);
console.log(solvedRow);

