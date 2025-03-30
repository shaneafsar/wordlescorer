// @ts-nocheck
import logger from './debug/logger.js'
import MongoClientInstance from '../ts/mongo.js';

const uri = `mongodb+srv://${process.env['MONGODB_USER']}:${process.env['MONGODB_PASS']}@cluster0.yztewyz.mongodb.net/?retryWrites=true&w=majority`;

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
  async read(key, date = null, forceMongo = true) {
    let output;
    try {
      const database = this.mongoClient.db("wordlescorer");
      const collection = database.collection(this.name);
      if(key && date) {
        console.log('trying to find by key and date...', key, date);
        const datetime = getDateQuery(date);
        const query = {
          key, 
          datetime
        };
        output = await collection.findOne(query);
      }
      else if (key) {
        console.log('trying to find by key...', key);
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
        //console.log('trying to find by date...', date, { datetime });
        output = await collection.find({ datetime }).toArray();
      }
    } catch (e) {
      logger.error('WordleData | mongodb read | ',this.name,' | ', key, ' | ', e);
    }
    return output;
  }

  async tempUpdate() {
    try {
      const database = this.mongoClient.db("wordlescorer");
      const collection = database.collection(this.name);

      // First, correct the records that were incorrectly updated
      /*let correctionResult = await collection.updateMany(
        { datetime: { $type: "object" } },
        [{ $unset: "datetime" }]
      );*/
      //console.log(`${correctionResult.modifiedCount} documents corrected.`);

      // Then, properly update the 'datetime' field using an aggregation pipeline
      let updateResult = await collection.updateMany(
        { datetime: { $exists: true }, missingDate: true },
        [{ $set: { datetime: { $add: ["$datetime", (1000 * 60 * 60 * 24)] } } }]
      );
      console.log(`${updateResult.modifiedCount} documents updated.`);

      
      // Find documents where 'datetime' field is missing and sort by 'wordleNumber' descending

      /*
      const query = { datetime: { $exists: false } };

      const documents = await collection.find(query).sort({ wordleNumber: -1 }).toArray();
  
      if (documents.length === 0) {
        console.log('No documents to update');
        return;
      }

      let currentWordleNumber = null;
      let daysToSubtract = 0;
      const currentDate = new Date();
      let updatePromises = [];
      console.log('documents count: ', documents.length);
      
      // Grouping documents by wordleNumber
      for (const doc of documents) {
        if (doc.wordleNumber !== currentWordleNumber) {
          currentWordleNumber = doc.wordleNumber;
          if (daysToSubtract > 0) {
            currentDate.setDate(currentDate.getDate() - 1);
          }
          daysToSubtract++;
  
          // Update all documents with current wordleNumber
          const updateDate = new Date(currentDate);
          updatePromises.push(
            collection.updateMany({ wordleNumber: currentWordleNumber, datetime: { $exists: false } }, { $set: { datetime: updateDate.getTime(), missingDate: true } })
          );
        }
      }

      console.log(`Documents updating...batches: `, updatePromises.length);
      await Promise.all(updatePromises);
      console.log(`Documents updated with adjusted datetimes`);*/
    } catch (err) {
      console.error('An error occurred:', err);
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
   * @param {string} key
   * @param {any} data
   * @param [{date}] date to filter on
   * @param [boolean] forceMongo - force to write only to mongoDB
   */
  async write(key, data, date = null, forceMongo = false) {
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
        /**
         * If possible, add epoch time
         */
        if(typeof data === 'object' &&
          !Array.isArray(data) &&
          data !== null &&
          !data.datetime) {
          data.datetime = Date.now();
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
      logger.error('WordleData | mongodb hasKey | ',this.name,' | ', val, ' | ', e);
    }
    return !doc ? false : true;
  }

  async loadData() {
    return Promise.resolve();
  }
};

export default WordleData;
