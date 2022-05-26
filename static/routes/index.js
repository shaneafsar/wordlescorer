var express = require('express');
var WordleDataP = import('../../WordleData.js');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  console.log('loading data...');
  WordleDataP.then((wd) => {
    var WordleData = wd.default;
    var AnalyzedTweetsDB = new WordleData('analyzed');
    AnalyzedTweetsDB.read().then(data => {
      var values = Object.values(data);
      var keys = Object.keys(data);
      var screenNameHash = {};
      var renderData = values.map((item, index) => {
        item.datestring = (new Date(item.datetime)).toLocaleDateString("en-US");  
        item.id = keys[index];
        screenNameHash[item.name] = { lastCheckTime: Date.now() };
        return item;
      }).sort((a,b) => b.datetime - a.datetime);
      
      //Render page
      res.render('index', { 
        title: 'Score My Wordle Info',
        datalist: renderData,
        scoredCount: renderData.length,
        userCount: Object.keys(screenNameHash).length
      });
    });
  });
});

module.exports = router;
