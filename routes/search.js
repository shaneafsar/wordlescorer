import * as express from "express";
import algoliasearch from 'algoliasearch';
import WordleData from '../WordleData.js';
import Twit from 'twit';


const router = express.Router();

const TWIT_CONFIG = {
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token: process.env.access_token,
  access_token_secret: process.env.access_token_secret,
};

const client = algoliasearch(
  process.env.algolia_app_id, 
  process.env.algolia_admin_key);

router.get('/', function (req, res, next) {  
  res.send('respond with a resource');
});

router.get('/user', function(req, res, next) {
  // Get id off of querystring
  const { user_id = null, screen_name, include_entities = null } = req.query;
  const T = new Twit(TWIT_CONFIG);

  T.get('users/lookup', { 
    user_id: user_id, 
    screen_name: screen_name,
    include_entities: !!include_entities
  }).then(({ data }) => {
    
    res.send(data.map(user => {
      return { photo: user.profile_image_url_https, screen_name:user.screen_name, user_id:user.id_str} }));
  });
});

router.get('/initphotos', function(req, res, next) {

  const T = new Twit(TWIT_CONFIG);

  const AnalyzedTweetsDB = new WordleData('analyzed');
  const UsersDB = new WordleData('users');
  
  AnalyzedTweetsDB.read().then(data => {
    const values = Object.values(data);
    const formattedDataSet = new Set(values.map((item, index) => {
      return item.scorerName || item.name;
    }));
    const formattedData = Array.from(formattedDataSet).map(item => item.slice(1));

    // API only allows for up to 100 usernames per request
    const chunkSize = 100;
    const chunkedNames = [];
    for (let i = 0; i < formattedData.length; i += chunkSize) {
      chunkedNames.push(formattedData.slice(i, i + chunkSize));
    }
  
    Promise.all(chunkedNames.map(chunk => {
      return T.post('users/lookup', { screen_name: chunk.join(',') });
    })).then((outputs) => {
      const formattedOutputs = outputs.map(({data}) => {
        return data.map(user => { 
          return { photo: user.profile_image_url_https, screen_name:user.screen_name, user_id:user.id_str };
        });
      });
     
      const dataToWrite = formattedOutputs.flat(1).reduce((r,e) => {
        r[e.user_id] = e;
        return r;
      }, {});

      if(!UsersDB.db.data) {
        UsersDB.db.data = dataToWrite;
        UsersDB.db.write();
      }
      
      res.send(dataToWrite);
    });
    
  });
});

const defaultPhotoUrl = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';

router.get('/indexdata', function (req, res, next) {

  const index = client.initIndex('analyzedwordles');

  const UsersDB = new WordleData('users');
  const AnalyzedTweetsDB = new WordleData('analyzed');

  Promise.all([AnalyzedTweetsDB.read(), UsersDB.read()]).then(([data, users]) => {
    const userMap = Object.values(users).reduce((r,e) => {
      r[e.screen_name] = e;
      return r;
    }, {});
    const values = Object.values(data);
    const keys = Object.keys(data);
    const formattedData = values.map((item, index) => {
      item.id = keys[index];
      item.scorerName = item.scorerName || item.name;
      delete item.name;
      item.date_timestamp = item.date_timestamp || Math.floor(item.datetime / 1000);
      item.photoUrl = userMap[item.scorerName.slice(1)]?.photo || defaultPhotoUrl;

      delete item.datetime;
      
      return item;
    }).filter(item => {
      // Ensure there's a score, tweet id, and a valid wordle
      // Early scored wordles don't have the property, and there was a brief period where invalid alt text could come back as wordleNumber === 0
      return Number.isInteger(item.score) && item.id && (!item.hasOwnProperty('wordleNumber') || item.wordleNumber !== 0);
    });

    
    // index.saveObjects(formattedData, { autoGenerateObjectIDIfNotExist: true })
    // .then(({ objectIDs }) => {
    //     console.log('indexed data');
    //     res.send('indexed data');
    // })
    // .catch(console.error);
    
    
  });
});

export default router;
