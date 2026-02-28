import isValidWordle from './shared/calculate/is-valid-wordle';
import { getSolvedRow } from './shared/calculate/get-solved-row';
import { getWordleNumberFromList } from './shared/extract/get-wordle-number-from-text';
import { calculateScoreFromWordleMatrix } from './shared/calculate/calculate-score-from-wordle-matrix';
import getWordleMatrixFromList from './shared/extract/get-wordle-matrix-from-list';
import { isWordleHardModeFromList } from './shared/extract/isWordleHardMode';
import { getSentenceSuffix } from './shared/display/get-sentence-suffix';
import { getCompliment } from './shared/display/getCompliment';
import WordleSource from './shared/enum/WordleSource';
import { checkIsSameDay } from './util';
import {
  hasAnalyzedPost, writeAnalyzedPost, writeGlobalScore,
  writeTopScore, writeUser, writeUserGrowth,
  getScorerGlobalStats,
} from './db';

export interface ProcessPostInput {
  text: string;
  altTexts: string[];
  postId: string;
  authorId: string;
  screenName: string;
  url: string;
  createdAt: string;
  source: WordleSource;
  isGrowth: boolean;
  photo?: string;
  /** For parent-post fallback — caller provides a function to fetch the parent */
  parentPostFetcher?: () => Promise<ProcessPostInput | null>;
}

export interface ProcessPostResult {
  replyText: string;
  shouldReply: boolean;
  wordleScore: number;
  wordleNumber: number;
  solvedRow: number;
}

function buildStatus(
  name: string, wordlePrefix: string, score: number,
  solvedRow: number, aboveTotal: string, isGrowth: boolean
): string {
  return `${name} This ${wordlePrefix} scored ${score} out of 420${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowth)}`;
}

/**
 * Process a Wordle post: extract → validate → calculate → write to DB → build reply text.
 * Returns null if the post is not a valid Wordle or has already been processed.
 */
export async function processWordlePost(
  db: D1Database,
  input: ProcessPostInput,
  processing: Set<string>,
  processed: Set<string>,
): Promise<ProcessPostResult | null> {
  const { text, altTexts, postId, authorId, screenName, url, createdAt, source, isGrowth, photo } = input;

  // Dedup check
  if (processing.has(postId) || processed.has(postId)) {
    return null;
  }

  const alreadyAnalyzed = await hasAnalyzedPost(db, postId);
  if (alreadyAnalyzed) {
    processed.add(postId);
    return null;
  }

  processing.add(postId);

  try {
    const listOfContent = [text, ...altTexts];
    const wordleMatrix = getWordleMatrixFromList(listOfContent);
    const wordleNumber = getWordleNumberFromList(listOfContent);
    const isHardMode = isWordleHardModeFromList(listOfContent);
    const solvedRow = getSolvedRow(wordleMatrix);

    const isValid = isValidWordle(wordleMatrix, wordleNumber, solvedRow, isGrowth);

    if (isValid) {
      const wordleScore = calculateScoreFromWordleMatrix(wordleMatrix, isHardMode).finalScore;

      // Write to DB
      await writeGlobalScore(db, authorId, {
        wordleNumber, wordleScore, solvedRow,
        screenName, url, userId: authorId,
        isHardMode, source,
      });

      const createdAtDate = new Date(createdAt);
      if (checkIsSameDay(createdAtDate)) {
        await writeTopScore(db, authorId, {
          screenName, wordleNumber, score: wordleScore,
          solvedRow, source, url,
          autoScore: isGrowth, isHardMode,
          datetime: createdAtDate.getTime(),
        });
      }

      await writeAnalyzedPost(db, postId, {
        scorerName: screenName, wordleNumber, score: wordleScore,
        solvedRow, isHardMode, source, url, autoScore: isGrowth,
      });

      if (photo && authorId) {
        await writeUser(db, authorId, { screenName, photo, source });
      }

      await writeUserGrowth(db, authorId, { source });

      // Build reply
      const { wordlePrefix, aboveTotal } = await getScorerGlobalStats(db, {
        solvedRow, wordleNumber, date: new Date(),
      });

      const replyText = buildStatus(screenName, wordlePrefix, wordleScore, solvedRow, aboveTotal, isGrowth);

      return {
        replyText,
        shouldReply: true,
        wordleScore,
        wordleNumber,
        solvedRow,
      };
    }

    // If not valid, try parent post fallback
    if (!isGrowth && input.parentPostFetcher) {
      const parentInput = await input.parentPostFetcher();
      if (parentInput) {
        return processWordlePost(db, parentInput, processing, processed);
      }
    }

    return null;
  } catch (e) {
    console.error(`[process-post] Error processing ${postId}:`, e);
    return null;
  } finally {
    processing.delete(postId);
    processed.add(postId);
  }
}

/**
 * Process a post for global-scores only (non-follower hashtag posts).
 * No reply, no analyzed_posts, no top_scores.
 */
export async function processGlobalScoreOnly(
  db: D1Database,
  input: { text: string; altTexts: string[]; authorId: string; screenName: string; url: string; source: WordleSource }
): Promise<void> {
  const listOfContent = [input.text, ...input.altTexts];
  const wordleMatrix = getWordleMatrixFromList(listOfContent);
  const wordleNumber = getWordleNumberFromList(listOfContent);
  const isHardMode = isWordleHardModeFromList(listOfContent);
  const solvedRow = getSolvedRow(wordleMatrix);

  if (isValidWordle(wordleMatrix, wordleNumber, solvedRow)) {
    const wordleScore = calculateScoreFromWordleMatrix(wordleMatrix, isHardMode).finalScore;

    await writeGlobalScore(db, input.authorId, {
      wordleNumber, wordleScore, solvedRow,
      screenName: input.screenName, url: input.url,
      userId: input.authorId, isHardMode, source: input.source,
    });
  }
}
