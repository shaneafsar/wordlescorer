import * as express from "express";
import WordleData from '../WordleData.js';
import getGlobalStats from '../utils/get-global-stats.js';
import getPercent from '../utils/get-percent.js';
var router = express.Router();
/* GET home page. */
router.get('/', function(req, res, next) {
  console.log('loading data...');

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
      return item;
    }).sort((a,b) => b.datetime - a.datetime);

    const renderDate = new Intl.DateTimeFormat("en-US", { 
        dateStyle: 'short', 
        timeStyle: 'long'
    }).format(new Date());

    getGlobalStats(new Date()).then((stats) => {
      
      // Add percents to each stat
      stats.forEach(item => {
        item.solvedRowPercents = item.solvedRowCounts.map(row => { 
          return getPercent(row, item.total);
        });
      });

      
      //Render page
      res.render('index', { 
        title: 'Score My Wordle Bot Info',
        globalStats: stats,
        datalist: renderData,
        scoredCount: renderData.filter(item => item.score).length,
        userCount: Object.keys(screenNameHash).length,
        lastUpdated: renderDate
      });
    });
  });

});
export default router;
