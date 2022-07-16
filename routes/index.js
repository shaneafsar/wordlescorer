import * as express from "express";
import WordleData from '../WordleData.js';
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
    
    //Render page
    res.render('index', { 
      title: 'Score My Wordle Info',
      datalist: renderData,
      scoredCount: renderData.filter(item => item.score).length,
      userCount: Object.keys(screenNameHash).length,
      lastUpdated: renderDate
    });
  });

});
export default router;
