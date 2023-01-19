import algoliasearch, { SearchIndex } from 'algoliasearch';
import TwitterWordleBot from "./TwitterWordleBot";
import MastoWordleBot from './MastoWordleBot';
import type { MastoClient } from 'masto';
import getGlobalScoreDB from '../utils/db/get-global-score-DB.js';
import getTopScoreDB from '../utils/db/get-top-score-DB.js';
import { setDelayedFunction } from '../utils/set-delayed-function.js';
import WordleData from "../WordleData.js";
import { 
    TwitterApi, 
    TwitterApiTokens 
} from "twitter-api-v2";
import { login } from 'masto';
import getGlobalStats from '../utils/db/get-global-stats.js';
import getFormattedGlobalStats from '../utils/display/get-formatted-global-stats.js';
import logError from '../utils/debug/log-error.js';
import getTopScorerInfo from '../utils/db/get-top-scorer-info.js';
import { getFormattedDate } from '../utils/display/get-formatted-date.js';
import { getCompliment } from '../utils/display/get-compliment';
import logConsole from '../utils/debug/log-console';

const TWIT_CONFIG = {
    consumer_key: process.env['consumer_key'],
    consumer_secret: process.env['consumer_secret'],
    access_token: process.env['access_token'],
    access_token_secret: process.env['access_token_secret'],
};

const TWITTER_OAUTH_V1: TwitterApiTokens = {
    appKey: TWIT_CONFIG.consumer_key || '',
    appSecret: TWIT_CONFIG.consumer_secret || '',
    accessToken: TWIT_CONFIG.access_token || '',
    accessSecret: TWIT_CONFIG.access_token_secret || ''
};

const TWITTER_OAUTH_V2: string = process.env['bearer_token'] || '';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

const ALGOLIA_AUTH = {
    appId: process.env['algolia_app_id'] || '', 
    adminKey: process.env['algolia_admin_key'] || ''
};

const MASTO_AUTH = {
    url: process.env['MASTO_URI'] || '',
    accessToken: process.env['MASTO_ACCESS_TOKEN'] || ''
};


export default class BotController {
    private GlobalScores: WordleData = getGlobalScoreDB();
    private TopScores: WordleData = getTopScoreDB();

    private TOAuthV1Client: TwitterApi;
    private TOAuthV2Client: TwitterApi;

    private MClient: MastoClient | undefined;

    private WordleSearchIndex: SearchIndex;

    private TWordleBot: TwitterWordleBot | undefined;
    private MWordleBot: MastoWordleBot | undefined;


    constructor() {
        this.TOAuthV1Client = new TwitterApi(TWITTER_OAUTH_V1);
        this.TOAuthV2Client = new TwitterApi(TWITTER_OAUTH_V2);

        const algSearchInst = algoliasearch(ALGOLIA_AUTH.appId, ALGOLIA_AUTH.adminKey);
        this.WordleSearchIndex = algSearchInst.initIndex('analyzedwordles');
    }

    async buildBots() {
        try {
            const [TWordleBot, MWordleBot] = await Promise.all([
                this.initTwitterBot(),
                this.initMastoBot()
            ]);

            this.TWordleBot = TWordleBot;
            this.MWordleBot = MWordleBot;

            await this.TWordleBot.initialize();
            console.log('*** Initialized Twitter Bot ***');


            await this.MWordleBot.initialize();
            console.log('*** Initialized Mastodon Bot ***');

        } catch (e) {
            logError('Error initializing twitter & mastodon bots | ', e);
        }
    }

    private reloadGlobalScores() {
        this.GlobalScores = getGlobalScoreDB();
        this.TopScores = getTopScoreDB();
    }

    async postGlobalStats(date: Date) {
        const stats = await getGlobalStats(date);
        const formattedStats = getFormattedGlobalStats(stats);
        formattedStats.forEach((item, index) => {
            // Wait one minute between posts
            const timeoutVal = 60000 * (index + 1);
            setTimeout(async () => {
                if(!IS_DEVELOPMENT) {
                    const [tResult, mResult] = await Promise.all([
                        this.TOAuthV1Client.v2.tweet(item),
                        this.MClient?.statuses.create({ status: item })
                    ]);      
                    logConsole('Global tweet result: ', tResult);
                    logConsole('Global masto result: ', mResult);
                } else {
                    logConsole('Global devmode result: ', item);
                }
            }, timeoutVal);
        });
        
        // Run again for tomorrow!
        setDelayedFunction(this.postGlobalStats.bind(this));
    }


    async postDailyTopScore(date: Date) {
        const scorer = await getTopScorerInfo(date);
        
        if (scorer) {
            const scorerText = `${scorer.screenName}! They scored ${scorer.score} points for Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;
            const finalStatus = `The top scorer for ${getFormattedDate(date)} is: ${scorerText}`;

            if(!IS_DEVELOPMENT) {
                this.TOAuthV1Client.v2.tweet(finalStatus);
                this.MClient?.statuses.create({ status: finalStatus });
            } else {
                logConsole(`Daily top score post | ${finalStatus} | Scorer: ${scorer}`);
            }
        }

        // Run again for tomorrow!
        setDelayedFunction(this.postDailyTopScore.bind(this));

        this.reloadGlobalScores();
    }

    private async initTwitterBot() {
        const userGrowth = new WordleData('user-growth');
        const analyzedPosts = new WordleData('analyzed');
        const users = new WordleData('users');
        const lastMention = new WordleData('last-mention');

        await Promise.all([
            this.GlobalScores.loadData(),
            this.TopScores.loadData(),
            userGrowth.loadData(),
            analyzedPosts.loadData(),
            users.loadData(),
            lastMention.loadData()
        ]);
      
        return new TwitterWordleBot(
          this.TOAuthV2Client,
          this.TOAuthV1Client,
          this.WordleSearchIndex,
          this.GlobalScores, 
          this.TopScores,
          userGrowth,
          analyzedPosts,
          users,
          lastMention);
    }

    private async initMastoBot() {
        const userGrowth = new WordleData('user-growth_masto');
        const analyzedPosts = new WordleData('analyzed_masto');
        const users = new WordleData('users_masto');
        const lastMention = new WordleData('last-mention_masto');


        if(!this.MClient) {
            this.MClient = await login(MASTO_AUTH);
        }

        await Promise.all([
            this.GlobalScores.loadData(),
            this.TopScores.loadData(),
            userGrowth.loadData(),
            analyzedPosts.loadData(),
            users.loadData(),
            lastMention.loadData()
        ]);
      
        return new MastoWordleBot(
          this.MClient,
          this.WordleSearchIndex,
          this.GlobalScores, 
          this.TopScores,
          userGrowth,
          analyzedPosts,
          users,
          lastMention);
    }
}