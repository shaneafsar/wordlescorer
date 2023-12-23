import logger from './logger.js';

function logConsole() {
  const args = Array.prototype.slice.call(arguments);
  const prefix = (new Date()).toUTCString() + ' | ';
  console.log.apply(console, [prefix].concat(args));
  /*if(logger && logger.log) {
    logger.log.apply(logger, [prefix].concat(args));
  }*/
}

export default logConsole;