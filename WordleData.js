import { join, dirname } from 'path'
import { Low, JSONFile } from 'lowdb'
import { fileURLToPath } from 'url'
import logger from './utils/debug/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url));

class WordleData {
  /**
   * Create an instance of a WordleData
   * @param {string} name 
   * @param {string} [subdir] 
   */
  constructor(name, subdir) {
    const file = join(__dirname, 'db', subdir ? `${subdir}` : '', `db.${name}.json`);
    this.file = file;
    const adapter = new JSONFile(file);
    this.db = new Low(adapter);
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
    return new WordleData(`${name}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCFullYear()}`, name);
  }

  /**
   * Async method -- will always load data if not available
   * @param {string|null} key key of data to return. if null, returns all data if available.
   * @returns {Promise<any>}
   */
  async read(key) {
    await this.loadData();

    if(key) {
      return this.db.data?.[key];
    }
    return this.db.data || {};
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
   * @param {any} data - push into array
   */
  async push(key, data) {
    await this.loadData();

    if(!this.db.data?.[key]) {
      this.db.data[key] = [];
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

    this.db.data[key].push(data);

    await this.db.write().catch(e => {
      console.log('WordleData | push | ', this.file, ' | ', e);
      logger.error('WordleData | push | ', this.file, ' | ', e);
    });
  }

  /**
   * @param {string} key
   * @param {any} data
   */
  async write(key, data) {
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

 /**
   * Synchronous method which returns the existance of a key
   * @param {string} key
   * @returns {boolean} true if key exists in data
   */
  hasKey(key) {
    if(!this.db.data) {
      throw 'WordleData: hasKey requires db.loadData() to have been called';
    }
    return !!this.db.data[key];
  }

  async loadData() {
    if(!this.db.data) {
      return await this.db.read();
    }
    return Promise.resolve();
  }
};

export default WordleData;
