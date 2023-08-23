// @ts-nocheck
import * as express from "express";
import WordleData from '../../js/WordleData.js';
import getGlobalStats from '../../js/db/get-global-stats.js';
import getTopScorerInfo from '../../js/db/get-top-scorer-info.js';
import getPercent from '../../js/display/get-percent.js';

var formatter = new Intl.NumberFormat().format;

var router = express.Router();
/* GET home page. */
router.get('/', (_req, res) => {
  console.log('[web] loading data...');
  const currentDate = new Date();
  const AnalyzedTweetsDB = new WordleData('analyzed');
  AnalyzedTweetsDB.read().then(data => {
    var values = Object.values(data);
    var keys = Object.keys(data);
    var screenNameHash = {};
    var renderData = values.map((item, index) => {
      item.datestring = (new Date(item.datetime)).toLocaleDateString("en-US");  
      item.id = keys[index];
      if(item.score) {
        screenNameHash[item.name] = { lastCheckTime: Date.now() };
      }
      // Only include highlights for dates after this time.
      if(item.datetime > 1666286675411) {
        item.isManual = !item.autoScore;
      }
      item.name = item.scorerName || item.name;
      return item;
    }).sort((a,b) => b.datetime - a.datetime);

  
    
    const renderDate = new Intl.DateTimeFormat("en-US", { 
        dateStyle: 'short', 
        timeStyle: 'long',
        timeZone: 'America/New_York'
    }).format(currentDate);

    Promise.all([
      getGlobalStats(currentDate), 
      getTopScorerInfo(currentDate)]).then(results => {
      const stats = results[0];
      const topScorerInfo = results[1];
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
        //datalist: renderData,
        scoredCount: renderData.filter(item => item.score).length,
        userCount: Object.keys(screenNameHash).length,
        lastUpdated: renderDate
      });
    });
  });
});
export default router;
