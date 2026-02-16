import MastoWordleBot from './bots/MastoWordleBot.js';
import BlueskyWordleBot from './bots/BlueskyWordleBot.js';
import { RichText, AtpAgent } from '@atproto/api';
import { mastodon, createRestAPIClient, createStreamingAPIClient } from 'masto';
import getGlobalScoreDB from './db/get-global-score-DB.js';
import getTopScoreDB from './db/get-top-score-DB.js';
import { setDelayedFunctionWithPromise } from './util/set-delayed-function.js';
import WordleData from "./db/WordleData.js";
import getGlobalStats from './db/get-global-stats.js';
import getFormattedGlobalStats from './display/get-formatted-global-stats.js';
import logError from './debug/log-error.js';
import getTopScorerInfo from './db/get-top-scorer-info.js';
import { getFormattedDate } from './display/get-formatted-date.js';
import { getCompliment } from './display/getCompliment.js';
import { retry } from './util/retry.js';
import logConsole from './debug/log-console.js';
import dotenv from 'dotenv';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

const IS_INGESTION_ONLY = process.env['IS_INGESTION_ONLY'] === 'true';

if (IS_DEVELOPMENT) {
    dotenv.config();
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

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export default class BotController {
    private GlobalScores: WordleData;
    private TopScores: WordleData;

    private MClient: mastodon.rest.Client | undefined;
    private MStreaming: mastodon.streaming.Client | undefined;

    private BAgent: AtpAgent | undefined;

    private MWordleBot: MastoWordleBot | undefined;
    private BSkyBot: BlueskyWordleBot | undefined;


    constructor() {

        this.GlobalScores = getGlobalScoreDB();
        this.TopScores = getTopScoreDB();
    }

    static async postOnly():Promise<void> {
        let botController:BotController|null = new BotController();
        await botController.buildBots();

        // Assume we are running this as a cron at the top of the current day
        const currentDate = new Date();
        const yesterday = new Date(currentDate);
        yesterday.setDate(currentDate.getDate() - 1);

        await botController.postDailyTopScore(yesterday);
        await botController.postGlobalStats(yesterday);
        
        botController.destroy();
        botController = null;
    }

    static async initialize():Promise<void> {
        let botController:BotController|null = new BotController();
        await botController.buildBots();

        logConsole('[bot] Waiting 24 hours before next run...');
        await wait(24 * 60 * 60 * 1000); // 24 hours
        logConsole('[bot] BotController finished.');
        
        botController.destroy();
        botController = null;
    }

    private destroy() {
        this.MWordleBot?.destroy();
        this.BSkyBot?.destroy();
        this.MClient = undefined;
        this.MStreaming = undefined;
        this.BAgent = undefined;
        this.MWordleBot = undefined;
        this.BSkyBot = undefined;
    }

    private async buildBots() {
        logConsole("[bot] IS_INGESTION_ONLY? ", IS_INGESTION_ONLY);
        try {
            if(ENABLE_MASTO_BOT) {
                this.MWordleBot = await retry(
                    () => this.initMastoBot(),
                    3, // Retry up to 10 times
                    1000, // Start with 1 second delay
                    (error) => true // Retry always
                );
                if (this.MWordleBot && IS_INGESTION_ONLY) {
                    await retry(() => this.MWordleBot!.initialize(), 10, 1000);
                    logConsole('[bot] Initialized Mastodon Bot');
                } else if (IS_INGESTION_ONLY) {
                    logError('[bot] Failed to initialize Mastodon Bot after retries, skipping');
                }
            }

            if(ENABLE_BSKY_BOT) {
                this.BSkyBot = await retry(
                    () => this.initBskyBot(),
                    3,
                    1000,
                    (error) => true
                );
                if (this.BSkyBot && IS_INGESTION_ONLY) {
                    await retry(() => this.BSkyBot!.initialize(), 3, 1000);
                    logConsole('[bot] Initialized Bluesky Bot');
                } else if (IS_INGESTION_ONLY) {
                    logError('[bot] Failed to initialize Bluesky Bot after retries, skipping');
                }
            }

        } catch (e) {
            logError('[bot] Error initializing bots | ', e);
        }
    }

    async postGlobalStats(date: Date): Promise<void> {
      try {
        const stats = await getGlobalStats(date, null, true);
        const formattedStats = getFormattedGlobalStats(stats);

        // Only post the most popular one for now.
        const singleFormattedStat = [formattedStats[0]];

        for (const [index, item] of singleFormattedStat.entries()) {
          // Wait 10s between posts
          const timeoutVal = 10000 * index;

          await new Promise((resolve) => setTimeout(resolve, timeoutVal));

          if (!IS_DEVELOPMENT) {
            try {
              await this.MClient?.v1.statuses.create({ status: item });
            } catch (err) {
              logError('[bot] postGlobalStats masto error: ', err);
            }

            if (this.BAgent) {
              try {
                const rt = new RichText({ text: item });
                await rt.detectFacets(this.BAgent);
                await this.BAgent.post({ text: rt.text, facets: rt.facets });
              } catch (err) {
                logError('[bot] postGlobalStats bsky error: ', err);
              }
            }
            logConsole('[bot] postGlobalStats result: ', item);
          } else {
            logConsole(`[bot] [DRY RUN] postGlobalStats: ${item}`);
          }
        }
      } catch (e) {
        logError('[bot] postGlobalStats failed: ', e);
      }
    }


    async postDailyTopScore(date: Date): Promise<void> {
      
        const scorer = await getTopScorerInfo(date, true);
        
        if (scorer) {
            const formattedDate = getFormattedDate(date);
            const scorerAppend = `They scored ${scorer.score} points for #Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;
            const scorerNameOnly = `${scorer.screenName || scorer.scorerName || scorer.name}!`;
            const finalStatus = `The top scorer for ${formattedDate} is: ${scorerNameOnly} ${scorerAppend}`;

            if(!IS_DEVELOPMENT) {
                await this.MClient?.v1.statuses.create({ status: finalStatus });
                if(this.BAgent) {
                    const rt = new RichText({text: finalStatus});
                    await rt.detectFacets(this.BAgent);
                    await this.BAgent.post({ text: rt.text, facets: rt.facets});
                }
            }
            logConsole(`[bot] ${IS_DEVELOPMENT ? '[DRY RUN] ' : ''}Daily top score | ${finalStatus}`);
        } else {
            logConsole('[bot] No top scorer found today');
        }
    }

    private async initBskyBot() {
        const userGrowth = new WordleData('user-growth_bsky');
        const analyzedPosts = new WordleData('analyzed_bsky');
        const users = new WordleData('users_bsky');
        
        if(!this.BAgent) {
            this.BAgent = new AtpAgent({
                service: 'https://bsky.social',
              });
            await this.BAgent.login(BSKY_AUTH);
        }
      
        return new BlueskyWordleBot(
            this.BAgent,
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
            this.MClient = createRestAPIClient({
                url: MASTO_AUTH.url,
                accessToken: MASTO_AUTH.accessToken,
            });
            this.MStreaming = createStreamingAPIClient({
                streamingApiUrl: MASTO_AUTH.url.replace(/\/$/, '') + '/api/v1/streaming',
                accessToken: MASTO_AUTH.accessToken,
            });
        }

        return new MastoWordleBot(
          this.MClient,
          this.MStreaming!,
          this.GlobalScores,
          this.TopScores,
          userGrowth,
          analyzedPosts,
          users,
          lastMention);
    }
}