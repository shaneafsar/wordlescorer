import * as express from "express";
import algoliasearch from 'algoliasearch';
import WordleData from '../WordleData.js';


const router = express.Router();

const client = algoliasearch(
  process.env.algolia_app_id, 
  process.env.algolia_admin_key);

router.get('/', function (req, res, next) {  
  res.send('respond with a resource');
});

router.get('/indexdata', function (req, res, next) {


  
  const index = client.initIndex('analyzedwordles');
  
  const AnalyzedTweetsDB = new WordleData('analyzed');
  
  AnalyzedTweetsDB.read().then(data => {
    const values = Object.values(data);
    const keys = Object.keys(data);
    const screenNameHash = {};
    const formattedData = values.map((item, index) => {
      item.id = keys[index];
      return item;
    });
    index.saveObjects(formattedData, { autoGenerateObjectIDIfNotExist: true })
    .then(({ objectIDs }) => {
        console.log('indexed data');
        res.send('indexed data');
    })
    .catch(console.error);
  })
  .catch(console.error);
});

export default router;
