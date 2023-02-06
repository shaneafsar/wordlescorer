import algoliasearch, { SearchIndex } from 'algoliasearch';
import TwitterWordleBot from "./bots/TwitterWordleBot.js";
import MastoWordleBot from './bots/MastoWordleBot.js';
import type { mastodon } from 'masto';
import getGlobalScoreDB from '../js/db/get-global-score-DB.js';
import getTopScoreDB from '../js/db/get-top-score-DB.js';
import { setDelayedFunction } from '../js/set-delayed-function.js';
import WordleData from "../js/WordleData.js";
import { 
    TwitterApi, 
    TwitterApiTokens 
} from "twitter-api-v2";
import { login } from 'masto';
import getGlobalStats from '../js/db/get-global-stats.js';
import getFormattedGlobalStats from '../js/display/get-formatted-global-stats.js';
import logError from '../js/debug/log-error.js';
import getTopScorerInfo from '../js/db/get-top-scorer-info.js';
import { getFormattedDate } from '../js/display/get-formatted-date.js';
import { getCompliment } from '../js/display/get-compliment.js';
import logConsole from '../js/debug/log-console.js';
import dotenv  from 'dotenv';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

if (IS_DEVELOPMENT) {
    dotenv.config();
};

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



const ALGOLIA_AUTH = {
    appId: process.env['algolia_app_id'] || '', 
    adminKey: process.env['algolia_admin_key'] || ''
};

const MASTO_AUTH = {
    url: process.env['MASTO_URI'] || '',
    accessToken: process.env['MASTO_ACCESS_TOKEN'] || ''
};

const ENABLE_TWITTER_BOT = true;


export default class BotController {
    private GlobalScores: WordleData;
    private TopScores: WordleData;

    private TOAuthV1Client: TwitterApi;
    private TOAuthV2Client: TwitterApi;

    private MClient: mastodon.Client | undefined;

    private WordleSearchIndex: SearchIndex;

    private TWordleBot: TwitterWordleBot | undefined;
    private MWordleBot: MastoWordleBot | undefined;


    constructor() {
        this.TOAuthV1Client = new TwitterApi(TWITTER_OAUTH_V1);
        this.TOAuthV2Client = new TwitterApi(TWITTER_OAUTH_V2);

        this.GlobalScores = getGlobalScoreDB();
        this.TopScores = getTopScoreDB();

        const algSearchInst = algoliasearch(ALGOLIA_AUTH.appId, ALGOLIA_AUTH.adminKey);
        this.WordleSearchIndex = algSearchInst.initIndex('analyzedwordles');
    }

    static async initialize():Promise<BotController> {
        const botController = new BotController();
        await botController.loadScoreData();
        await botController.buildBots();
        setDelayedFunction(botController.postDailyTopScore.bind(botController));
        setDelayedFunction(botController.postGlobalStats.bind(botController));
        return botController;
    }

    private async loadScoreData() {
        await this.GlobalScores.loadData();
        await this.TopScores.loadData();
    }

    private async buildBots() {
        try {
            const [TWordleBot, MWordleBot] = await Promise.all([
                this.initTwitterBot(),
                this.initMastoBot()
            ]);

            this.TWordleBot = TWordleBot;
            this.MWordleBot = MWordleBot;

            if(ENABLE_TWITTER_BOT) {
                await this.TWordleBot.initialize();
                console.log('*** BotController:  Initialized Twitter Bot ***');
            }


            await this.MWordleBot.initialize();
            console.log('*** BotController:  Initialized Mastodon Bot ***');

        } catch (e) {
            logError('Error initializing twitter & mastodon bots | ', e);
        }
    }

    private reloadGlobalScores() {
        console.log('*** BotController: reloadGlobalScores');
        this.GlobalScores = getGlobalScoreDB();
        this.TopScores = getTopScoreDB();
        this.loadScoreData();
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
                        this.MClient?.v1.statuses.create({ status: item })
                    ]);      
                    logConsole('postGlobalStats tweet result: ', tResult);
                    logConsole('postGlobalStats masto result: ', mResult);
                } else {
                    logConsole('postGlobalStats DEVMODE result: ', item);
                }
            }, timeoutVal);
        });
        
        // Run again for tomorrow!
        setDelayedFunction(this.postGlobalStats.bind(this));
    }


    async postDailyTopScore(date: Date) {
        const scorer = await getTopScorerInfo(date);
        
        if (scorer) {
            const formattedDate = getFormattedDate(date);
            const scorerAppend = `They scored ${scorer.score} points for #Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;
            const scorerNameOnly = `${scorer.screenName}!`;
            const finalStatus = `The top scorer for ${formattedDate} is: ${scorerNameOnly} ${scorerAppend}`;

            // Send a separate status for mastodon. 
            // If the winner is from twitter, need to append @twitter.com to the username.
            const mastodonStatus = scorer.source !== 'mastodon' ? 
            `The top scorer for ${formattedDate} is: ${scorer.screenName}@twitter.com! ${scorerAppend}` : 
            finalStatus;

            if(!IS_DEVELOPMENT) {
                this.TOAuthV1Client.v2.tweet(finalStatus);
                this.MClient?.v1.statuses.create({ status: mastodonStatus });
            }
            logConsole(`Daily top score ${IS_DEVELOPMENT? 'DEVMODE' : ''} Masto | ${mastodonStatus}`);
        } else {
            logConsole(`No top scorer found today`);
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