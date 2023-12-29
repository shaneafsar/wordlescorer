// @ts-nocheck
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs';
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import logger from './debug/logger.js'
import MongoClientInstance from '../ts/mongo.js';

const uri = `mongodb+srv://${process.env['MONGODB_USER']}:${process.env['MONGODB_PASS']}@cluster0.yztewyz.mongodb.net/?retryWrites=true&w=majority`;

const ENABLE_MONGO_READ = true;
const ENABLE_MONGO_WRITE_ONLY = true;

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function getDateQuery(date) {
  // Start of day in UTC
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);
  const startOfDay = startDate.getTime();

  // End of day in UTC: start of next day minus 1 millisecond
  const endDate = new Date(date);
  endDate.setUTCDate(startDate.getUTCDate() + 1);
  endDate.setUTCHours(0, 0, 0, 0);
  const endOfDay = endDate.getTime() - 1;

  return {
    $gte: startOfDay,
    $lt: endOfDay
  };
}

class WordleData {
  /**
   * Create an instance of a WordleData
   * @param {string} name 
   * @param {string} [subdir]
   * @param {Date} [date]
   */
  constructor(name, subdir, date) {
    this.mongoClient = MongoClientInstance; 
    
    this.date = date;

    this.name = subdir || name.split('_')[0];
    // Used only for last-mention
    if (name.includes('_')) {
      this.recordType = name.split('_')[1];
      if(this.recordType === 'masto') {
        this.recordType = 'mastodon';
      }
    }

    if(!ENABLE_MONGO_READ) {
      const directory = join(__dirname, '..','..', 'db', subdir ? `${subdir}` : '');
      if(subdir) {
        makeDir(directory);
      }
      const file = join(directory, `db.${name}.json`);
      this.file = file;
      const adapter = new JSONFile(file);
      this.db = new Low(adapter);
    }
  }

  /**
   * Helper method for initializing a WordleData in a subdir, files partitioned by date.
   * @param {string} name - "table" name
   * @param {Date} [date] - append date to "table" name. Defaults to current date.
   * @returns new WordleData instance
   */
  static init(name, date) {
    if(!date) {
      date = new Date();
    }
    return new WordleData(`${name}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCFullYear()}`, name, date);
  }

  /**
   * Async method -- will always load data if not available
   * @param {string|null} [key] key of data to return. if null, returns all data if available.
   * @param {Date|null} [date] date of data to filter on (for mongodb)
    * @param {boolean} [forceMongo] force to read from mongoDB
   * @returns {Promise<any>}
   */
  async read(key, date = null, forceMongo = false) {
    if(ENABLE_MONGO_READ || forceMongo) {
      let output;
      try {
        const database = this.mongoClient.db("wordlescorer");
        const collection = database.collection(this.name);
        if(key && date) {
          const datetime = getDateQuery(date);
          const query = {
            key, 
            datetime
          };
          output = await collection.findOne(query);
        }
        else if (key) {
          if(key === 'since_id') {
            if(!this.since_id) {
              const doc = await collection.findOne({ key, source:this.recordType });
              output = doc.since_id;
            } else {
              output = this.since_id;
            }
          } else if(this.date) {
            const datetime = getDateQuery(this.date);
            output = await collection.findOne({ key, datetime });
          } else {
            output = await collection.findOne({ key });
          }
        } else if(date) {
          const datetime = getDateQuery(date);
          output = await collection.find({ datetime }).toArray();
        }
      } catch (e) {
        logger.error('WordleData | mongodb read | ',this.name,' | ', key, ' | ', e);
      }
    return output;
    } else {
      await this.loadData();
  
      if(key) {
        return this.db.data?.[key];
      }
      return this.db.data || {};
    }
  }

  async count() {
    let output;
    try {
      const database = this.mongoClient.db("wordlescorer");
      const collection = database.collection(this.name);
      output = await collection.countDocuments({}, { hint: "_id_" });
    } catch (e) {
      logger.error('WordleData | mongodb count | ',this.name,' | ', e);
    }
    return output;
  }

  /**
   * Sync method. Expects data to have already been read.
   * @param {string} key key of data to return. if null, returns all data if available.
   * @returns 
   */
  readSync(key) {
    if(key) {
      return this.db.data?.[key];
    }
    return this.db.data || {};
  }

  /**
   * @param {string} key
   * @param {any} data
   * @param [{date}] date to filter on
   * @param [boolean] forceMongo - force to write only to mongoDB
   */
  async write(key, data, date = null, forceMongo = false) {
    if(!ENABLE_MONGO_WRITE_ONLY) {
      await this.loadData();
  
      /**
       * If possible, add epoch time
       */
      if(typeof data === 'object' &&
        !Array.isArray(data) &&
        data !== null &&
        !data.datetime) {
        data.datetime = Date.now();
      }
  
      if(!this.db.data) {
        this.db.data = { [key] : data};
      }
      else {
        this.db.data[key] = data;
      }
  
      await this.db.write().catch(e => {
        console.log('WordleData | write | ', this.file, ' | ', e);
        logger.error('WordleData | write | ', this.file, ' | ', e);
      });
    }
    let output;
    try {
      const database = this.mongoClient.db("wordlescorer");
      const collection = database.collection(this.name);
      const query = {
        key
      };
      if (key === 'since_id') {
        query.source = this.recordType;
        this.since_id = data;
        output = await collection.replaceOne(query, { key, [key]: data, 'source': this.recordType }, { upsert: true});
      } else {
        if(date) {
          // Based on the above, along with the daily assumption,
          // always replace any record found with a new value.
          const startDate = new Date(date);
          startDate.setUTCHours(0, 0, 0, 0);
          const startOfToday = now.getTime();
          const endOfToday = (new Date(now).setDate(now.getDate() + 1)).getTime();
          query.datetime = {
            $gte: startOfToday,
            $lt: endOfToday
          };
        }
        const replace = {key, ...data};
        output = await collection.replaceOne(query, replace, { upsert: true});
      }
    } catch (e) {
      logger.error('WordleData | mongodb write | ',this.name,' | ', e);
    }
    return output;
  }

 /**
   * Synchronous method which returns the existance of a key
   * @param {string} key
   * @returns {boolean} true if key exists in data
   */
  hasKey(key) {
    if(this.db.data === null) {
      throw 'WordleData: hasKey requires db.loadData() to have been called';
    }
    return !!this.db.data[key];
  }

  /**
   * method which returns the existance of a key
   * @param {string} key
   * @returns {boolean} true if key exists in data
   */
  async hasKeyAsync(val) {
    let doc = null;
    try {
      const database = this.mongoClient.db("wordlescorer");
      const collection = database.collection(this.name);
      const query = {
        key: val
      };
      doc = await collection.findOne(query);
    } catch (e) {
      logger.error('WordleData | mongodb hasKey | ',this.name,' | ', key, ' | ', e);
    }
    return !doc ? false : true;
  }

  async loadData() {
    if(!ENABLE_MONGO_READ) {
      if(this.db.data === null) {
        try {
          await this.db.read();
          if(this.db.data === null) {
            this.db.data = {};
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return Promise.resolve();
  }
};

export default WordleData;
