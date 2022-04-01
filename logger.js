import fs from 'fs'
import { Console } from 'console'

const output = fs.createWriteStream('./stdout.log', {'flags': 'a'});
const errorOutput = fs.createWriteStream('./stderr.log', {'flags': 'a'});
const logger = new Console({ stdout: output, stderr: errorOutput });

export default logger;