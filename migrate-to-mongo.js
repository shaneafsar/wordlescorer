import { MongoClient } from 'mongodb'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const uri = `mongodb+srv://${process.env['MONGODB_USER']}:${process.env['MONGODB_PASS']}@cluster0.yztewyz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

const __dirname = dirname(fileURLToPath(import.meta.url));

// Convert the specified date to a Unix timestamp in milliseconds
const cutoffDateTime = new Date('2023-12-20T15:15:00-05:00').getTime();

const FILTER_DATE_TIME = false;

async function processFile(database, collectionName, filePath, source = '', filterDateTime = false) {
    console.log(`Processing file: ${filePath} for collection: ${collectionName}`);
    const data = JSON.parse(fs.readFileSync(__dirname + '/db/' + filePath, 'utf8'));
    const bulkOps = [];

    for (const key in data) {
        let document = { ...data[key], source };

        if (typeof data[key] === 'object' && data[key] !== null) {
            document.key = key;
        }

        // Skip processing if datetime is greater than or equal to cutoffDateTime
        if (FILTER_DATE_TIME && filterDateTime && document.datetime && document.datetime >= cutoffDateTime) {
            continue;
        }

        bulkOps.push({
            replaceOne: {
                filter: { key },
                replacement: document,
                upsert: true
            }
        });
    }

    if (bulkOps.length > 0) {
      console.log(`Starting processing ${filePath} with ${bulkOps.length} documents`);
        await database.collection(collectionName).bulkWrite(bulkOps);
    }

    console.log(`Completed processing ${filePath}`);
}

async function processScoreFiles(database, directory, collectionName) {
  console.log(`Processing directory: ${directory} for collection: ${collectionName}`);
    directory = __dirname + '/db/' + directory;
    const files = fs.readdirSync(directory);
    const bulkOps = [];

    for (const file of files) {
        if (file.startsWith('db.' + collectionName.toLowerCase() + '-') && file.endsWith('.json')) {
            try {
                const data = JSON.parse(fs.readFileSync(join(directory, file), 'utf8'));
                const fileBulkOps = [];
                for (const key in data) {
                    let document = { ...data[key], key };
                    if (!document.source) {
                        document.source = 'twitter';
                    }


                    // Skip processing if datetime is greater than or equal to cutoffDateTime
                    if (FILTER_DATE_TIME && document.datetime && document.datetime >= cutoffDateTime) {
                        continue;
                    }


                    // Prepare upsert operation for each document
                    fileBulkOps.push({
                        replaceOne: {
                            filter: { key, wordleNumber: document.wordleNumber },
                            replacement: document,
                            upsert: true
                        }
                    });
                }
              bulkOps.push(fileBulkOps);
            } catch (e) {
                console.error(`Error processing file ${file}: ${e.message}`);
            }
        }
    }

    if (bulkOps.length > 0) {
      console.log(`Starting processing files in directory: ${directory}, with ${bulkOps.length} files`);
      for(var i=0; i<bulkOps.length; i++) {
        const bulkOp = bulkOps[i];
        if(bulkOp.length > 0) {
          console.log(`Starting processing file ${i+1} of ${bulkOps.length}, with ${bulkOp.length} documents`);
          await database.collection(collectionName).bulkWrite(bulkOp);
          console.log(`Completed processing file ${i+1} of ${bulkOps.length}, with ${bulkOp.length} documents`);
        }
      }
        
    }
  console.log(`Completed processing directory: ${directory}`);
}

async function main() {
    try {
        await client.connect();
        const database = client.db("wordlescorer");
      console.log("Connected to MongoDB.");
        // Process 'analyzed', 'last-mention', 'user-growth', 'users' collections
       /* await processFile(database,'analyzed', 'db.analyzed_bsky.json', 'bluesky', true);
        await processFile(database,'analyzed', 'db.analyzed_masto.json', 'mastodon', true);
        await processFile(database,'analyzed', 'db.analyzed.json', 'twitter', true);
        await processFile(database,'user-growth', 'db.user-growth.json', 'twitter', true);
        await processFile(database,'user-growth', 'db.user-growth_masto.json', 'mastodon', true);
        await processFile(database,'user-growth', 'db.user-growth_bsky.json', 'bluesky', true);
        await processFile(database,'users', 'db.users.json', 'twitter', true);
        await processFile(database,'users', 'db.users_bsky.json', 'bluesky', true);
        await processFile(database,'users', 'db.users_masto.json', 'mastodon', true);*/

      await processFile(database,'last-mention', 'db.last-mention_masto.json', 'mastodon', true);
      await processFile(database,'last-mention', 'db.last-mention.json', 'twitter', true);

        // Process 'top-scores' and 'global-scores' collections
        // await processScoreFiles(database,'top-scores', 'top-scores');
        //await processScoreFiles(database,'global-scores', 'global-scores');

      console.log("All data processing completed.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main().catch(console.error);