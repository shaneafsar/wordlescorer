import algoliasearch, { SearchIndex } from 'algoliasearch';
import MastoWordleBot from './bots/MastoWordleBot.js';
import BlueskyWordleBot from './bots/BlueskyWordleBot.js';
import type { BskyAgent } from "@atproto/api";
import atproto from "@atproto/api";
import { mastodon } from 'masto';
import getGlobalScoreDB from '../js/db/get-global-score-DB.js';
import getTopScoreDB from '../js/db/get-top-score-DB.js';
import { setDelayedFunction } from '../js/set-delayed-function.js';
import WordleData from "../js/WordleData.js";
import { login } from 'masto';
import getGlobalStats from '../js/db/get-global-stats.js';
import getFormattedGlobalStats from '../js/display/get-formatted-global-stats.js';
import logError from '../js/debug/log-error.js';
import getTopScorerInfo from '../js/db/get-top-scorer-info.js';
import { getFormattedDate } from '../js/display/get-formatted-date.js';
import { getCompliment } from '../js/display/get-compliment.js';
import logConsole from '../js/debug/log-console.js';
import dotenv from 'dotenv';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

if (IS_DEVELOPMENT) {
    dotenv.config();
};

const ALGOLIA_AUTH = {
    appId: process.env['algolia_app_id'] || '', 
    adminKey: process.env['algolia_admin_key'] || ''
};

const MASTO_AUTH = {
    url: process.env['MASTO_URI'] || '',
    accessToken: process.env['MASTO_ACCESS_TOKEN'] || ''
};

const BSKY_AUTH = {
    identifier: process.env['BSKY_USERNAME'] || '',
    password: process.env['BSKY_PASSWORD'] || '',
};

const ENABLE_MASTO_BOT = true;
const ENABLE_BSKY_BOT = true;


export default class BotController {
    private GlobalScores: WordleData;
    private TopScores: WordleData;

    private MClient: mastodon.Client | undefined;

    private BAgent: BskyAgent | undefined;

    private WordleSearchIndex: SearchIndex;

    private MWordleBot: MastoWordleBot | undefined;
    private BSkyBot: BlueskyWordleBot | undefined;


    constructor() {

        this.GlobalScores = getGlobalScoreDB();
        this.TopScores = getTopScoreDB();

        const algSearchInst = algoliasearch.default(ALGOLIA_AUTH.appId, ALGOLIA_AUTH.adminKey);
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
            const [MWordleBot, BSkyBot] = await Promise.all([
                this.initMastoBot(),
                this.initBskyBot()
            ]);

            this.MWordleBot = MWordleBot;
            this.BSkyBot = BSkyBot;

            if(ENABLE_MASTO_BOT) {
                await this.MWordleBot.initialize();
                console.log('*** BotController:  Initialized Mastodon Bot ***');
            }

            if(ENABLE_BSKY_BOT) {
                await this.BSkyBot.initialize();
                console.log('*** BotController:  Initialized Bluesky Bot ***');
            }


        } catch (e) {
            logError('Error initializing bots | ', e);
        }
    }

    private async reloadGlobalScores() {
        console.log('*** BotController: reloadGlobalScores ***');
        this.GlobalScores = getGlobalScoreDB();
        this.TopScores = getTopScoreDB();
        //await this.loadScoreData();
    }

    async postGlobalStats(date: Date) {
        const stats = await getGlobalStats(date, null, true);
        const formattedStats = getFormattedGlobalStats(stats);
        // Only post the most popular one.
        const singleFormattedStat = [formattedStats[0]];
        singleFormattedStat.forEach((item, index) => {
            // Wait one minute between posts
            const timeoutVal = 60000 * (index + 1);
            setTimeout(async () => {
                if(!IS_DEVELOPMENT) {

                    this.MClient?.v1.statuses.create({ status: item }).catch((err) => {
                        logError('postGlobalStats masto error: ', err);
                    });

                    if(this.BAgent) {
                        const rt = new atproto.RichText({text: item});
                        await rt.detectFacets(this.BAgent);
                        this.BAgent.post({ text: rt.text, facets: rt.facets}).catch((err) => {
                            logError('postGlobalStats bsky error: ', err);
                        });
                    }

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
            // Note: twitter bot currently isn't setting source
            const mastodonStatus = (scorer.source !== 'mastodon' && scorer.source !== 'bluesky') ? 
            `The top scorer for ${formattedDate} is: ${scorer.screenName}@twitter.com! ${scorerAppend}` : 
            finalStatus;

            if(!IS_DEVELOPMENT) {
                this.MClient?.v1.statuses.create({ status: mastodonStatus });
                if(this.BAgent) {
                    const rt = new atproto.RichText({text: mastodonStatus});
                    await rt.detectFacets(this.BAgent);
                    this.BAgent.post({ text: rt.text, facets: rt.facets})
                }
            }
            logConsole(`Daily top score ${IS_DEVELOPMENT? 'DEVMODE' : ''} | ${mastodonStatus}`);
        } else {
            logConsole(`No top scorer found today`);
        }

        // Run again for tomorrow!
        setDelayedFunction(this.postDailyTopScore.bind(this));

        await this.reloadGlobalScores();
    }

    private async initBskyBot() {
        const userGrowth = new WordleData('user-growth_bsky');
        const analyzedPosts = new WordleData('analyzed_bsky');
        const users = new WordleData('users_bsky');
        
        if(!this.BAgent) {
            this.BAgent = new atproto.BskyAgent({
                service: 'https://bsky.social',
              });
            await this.BAgent.login(BSKY_AUTH);
        }

        await Promise.all([
            userGrowth.loadData(),
            analyzedPosts.loadData(),
            users.loadData(),
        ]);
      
        return new BlueskyWordleBot(
            this.BAgent,
            this.WordleSearchIndex,
            this.GlobalScores, 
            this.TopScores,
            userGrowth,
            analyzedPosts,
            users);
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