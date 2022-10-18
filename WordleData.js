import { join, dirname } from 'path'
import { Low, JSONFile } from 'lowdb'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url));

class WordleData {
  constructor(name, subdir) {
    const file = join(__dirname, 'db', subdir ? `${subdir}` : '', `db.${name}.json`);
    //console.log(file);
    const adapter = new JSONFile(file);
    this.db = new Low(adapter);
  }

  async read(key) {
    await this.loadData();

    if(key) {
      return this.db.data?.[key];
    }
    return this.db.data || {};
  }

  /**
   * @param {string} key
   * @param data - push into array
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

    await this.db.write();
  }

  /**
   * @param {string} key
   * @param data
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

    await this.db.write();
  }

  async loadData() {
    if(!this.db.data) {
      return await this.db.read();
    }
    return Promise.resolve();
  }
};

export default WordleData;
