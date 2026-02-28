import type { MastoClient } from './mastodon';
import { postStatus } from './mastodon';
import type { AtpAgent } from '@atproto/api';
import { postBskyStatus } from './bluesky';
import { getGlobalStats, getTopScorerInfo } from './db';
import getFormattedGlobalStats from './shared/display/get-formatted-global-stats';
import { getFormattedDate } from './shared/display/get-formatted-date';
import { getCompliment } from './shared/display/getCompliment';

export async function postDailyTopScore(
  db: D1Database, mastoClient: MastoClient | null, bskyAgent: AtpAgent | null,
  date: Date, dryRun: boolean = true
): Promise<string | null> {
  const scorer = await getTopScorerInfo(db, date);

  if (!scorer) {
    console.log('[daily] No top scorer found');
    return null;
  }

  const formattedDate = getFormattedDate(date);
  const scorerAppend = `They scored ${scorer.score} points for #Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;
  const scorerNameOnly = `${scorer.screenName || scorer.scorerName || scorer.name}!`;
  const finalStatus = `The top scorer for ${formattedDate} is: ${scorerNameOnly} ${scorerAppend}`;

  if (dryRun) {
    console.log('[daily] [DRY RUN] Would post daily top score:', finalStatus);
    return finalStatus;
  }

  if (mastoClient) {
    try {
      await postStatus(mastoClient, finalStatus);
    } catch (err) {
      console.error('[daily] postDailyTopScore masto error:', err);
    }
  }

  if (bskyAgent) {
    try {
      await postBskyStatus(bskyAgent, finalStatus);
    } catch (err) {
      console.error('[daily] postDailyTopScore bsky error:', err);
    }
  }

  console.log('[daily] Daily top score posted:', finalStatus);
  return finalStatus;
}

export async function postDailyGlobalStats(
  db: D1Database, mastoClient: MastoClient | null, bskyAgent: AtpAgent | null,
  date: Date, dryRun: boolean = true
): Promise<string | null> {
  try {
    const stats = await getGlobalStats(db, date);
    const formattedStats = getFormattedGlobalStats(stats);

    // Only post the most popular one
    const singleStat = formattedStats[0];
    if (!singleStat) {
      console.log('[daily] No global stats to post');
      return null;
    }

    if (dryRun) {
      console.log('[daily] [DRY RUN] Would post global stats:', singleStat);
      return singleStat;
    }

    if (mastoClient) {
      try {
        await postStatus(mastoClient, singleStat);
      } catch (err) {
        console.error('[daily] postGlobalStats masto error:', err);
      }
    }

    if (bskyAgent) {
      try {
        await postBskyStatus(bskyAgent, singleStat);
      } catch (err) {
        console.error('[daily] postGlobalStats bsky error:', err);
      }
    }

    console.log('[daily] Global stats posted:', singleStat);
    return singleStat;
  } catch (e) {
    console.error('[daily] postGlobalStats failed:', e);
    return null;
  }
}
