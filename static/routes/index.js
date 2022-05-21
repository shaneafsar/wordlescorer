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
      var datesort = {};
      var renderData = values.map((item) => {
        item.datestring = (new Date(item.datetime)).toLocaleDateString("en-US");
        if(datesort[item.datestring]) {
          datesort[item.datestring].push(item);
        } else {
          datesort[item.datestring] = [item];
        }
        return item;
      });

      //Render page
      res.render('index', { 
        title: 'Score My Wordle',
        datalist: data
      });
    });
  });
});

module.exports = router;
