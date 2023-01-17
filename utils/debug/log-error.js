import logger from './logger.js';

function logError(log) {
  const args = Array.prototype.slice.call(arguments);
  const prefix = (new Date()).toUTCString() + ' | ';
  console.error.apply(console, [prefix].concat(args));
  if(logger && logger.error) {
    logger.error.apply(logger, [prefix].concat(args));
  }
}

export default logError;