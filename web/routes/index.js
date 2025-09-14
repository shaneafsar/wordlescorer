// @ts-nocheck
import * as express from "express";
import WordleData from '../../js/WordleData.js';
import getGlobalStats from '../../ts/db/get-global-stats.js';
import getTopScorerInfo from '../../ts/db/get-top-scorer-info.js';
import getPercent from '../../ts/display/get-percent.js';
import getGlobalScoreDB from '../../ts/db/get-global-score-DB.js';

var formatter = new Intl.NumberFormat().format;

var router = express.Router();
/* GET home page. */
router.get('/', (_req, res) => {
  console.log('[web] loading data...');
  const currentDate = new Date();
  const UsersDB = new WordleData('users');
  const AnalyzedDB = new WordleData('analyzed');
  
  const renderDate = new Intl.DateTimeFormat("en-US", { 
      dateStyle: 'short', 
      timeStyle: 'long',
      timeZone: 'America/New_York'
  }).format(currentDate);

  Promise.all([
    getGlobalStats(currentDate, null, true), 
    getTopScorerInfo(currentDate, true),
    UsersDB.count(),
    AnalyzedDB.count()]).then(results => {
    const stats = results[0];
    const topScorerInfo = results[1];
    const userCount = results[2];
    const globalScoresCount = results[3];

    // Add percents to each stat
    stats.forEach(item => {
      item.solvedRowPercents = item.solvedRowCounts.map(row => {
        return getPercent(row, item.total);
      });
      item.solvedRowCounts = item.solvedRowCounts.map(row => {
        return formatter(row);
      });
      item.total = formatter(item.total);
    });

    const finalTime = new Date().setUTCHours(24,0,0,0);
    const currentTime = currentDate.getTime();
    const timeTillDailyTopScore = `Daily Top Score post happening in about ${((finalTime - currentTime)/1000/60/60).toFixed(2)} hours!`;

    //Render page
    res.render('index.pug', { 
      title: 'Score My Wordle',
      globalStats: stats,
      scoreMessage: timeTillDailyTopScore,
      topScorerInfo: topScorerInfo,
      scoredCount: globalScoresCount,
      userCount: userCount,
      lastUpdated: renderDate
    });
  });

});
export default router;
