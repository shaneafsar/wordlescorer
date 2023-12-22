import { Console } from 'console'

const logger = new Console({ stdout: process.stdout, stderr: process.stderr });

export default logger;