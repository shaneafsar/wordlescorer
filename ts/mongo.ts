import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

if (IS_DEVELOPMENT) {
  dotenv.config();
};

const uri = `mongodb+srv://${process.env['MONGODB_USER']}:${process.env['MONGODB_PASS']}@cluster0.yztewyz.mongodb.net/?retryWrites=true&w=majority`;

const MongoClientInstance = new MongoClient(uri, { 
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

console.log('Connecting to mongo...');
await MongoClientInstance.connect();
console.log('Connected to mongo!');

export default MongoClientInstance;