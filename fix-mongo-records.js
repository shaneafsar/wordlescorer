import { MongoClient } from 'mongodb'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import algoliasearch from 'algoliasearch';

const uri = `mongodb+srv://${process.env['MONGODB_USER']}:${process.env['MONGODB_PASS']}@cluster0.yztewyz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

const ALGOLIA_AUTH = {
    appId: process.env['algolia_app_id'] || '', 
    adminKey: process.env['algolia_admin_key'] || ''
};

const algSearchInst = algoliasearch.default(ALGOLIA_AUTH.appId, ALGOLIA_AUTH.adminKey);

const index = algSearchInst.initIndex('analyzedwordles');


async function run() {
    try {
        await client.connect();
        const database = client.db("wordlescorer");
        const collection = database.collection("top-scores");

        // Query and Update for March 14, 8pm EDT to March 15, 8pm EDT
        await collection.updateMany(
            {
                "datetime": {
                    "$gte": 1710460800000,
                    "$lt": 1710547200000
                },
                "wordleNumber": 1
            },
            {
                $set: { "wordleNumber": 1000 }
            }
        );

        // Query and Update for March 15, 8pm EDT to March 16, 8pm EDT
        await collection.updateMany(
            {
                "datetime": {
                    "$gte": 1710547200000,
                    "$lt": 1710633600000
                },
                "wordleNumber": 1
            },
            {
                $set: { "wordleNumber": 1001 }
            }
        );
        console.log('done!');
    } finally {
        await client.close();
    }
}

//run().catch(console.dir);


async function updateAlgoliaRecords() {
    // Define the two sets of date ranges and the corresponding wordleNumber updates
    const updates = [
        { start: 1710460800000, end: 1710547200000, wordleNumber: 1000 },
        { start: 1710547200000, end: 1710633600000, wordleNumber: 1001 }
    ];

    for (const update of updates) {
        let hitsToUpdate = [];
        await index.browseObjects({
            query: '', // Use an empty string for all records or set a specific query
            filters: `datetime >= ${update.start} AND datetime <= ${update.end} AND wordleNumber:1`,
            batch: (batch) => {
                hitsToUpdate = hitsToUpdate.concat(batch.map(hit => {
                    return { objectID: hit.objectID, wordleNumber: update.wordleNumber };
                }));
            }
        });

        // Push updates back to Algolia
        if (hitsToUpdate.length > 0) {
            await index.partialUpdateObjects(hitsToUpdate);
            console.log(`Updated ${hitsToUpdate.length} records to wordleNumber ${update.wordleNumber}`);
        }
    }
}

updateAlgoliaRecords().catch(console.error);