

function logConsole() {
  /*const args = Array.prototype.slice.call(arguments);
  const prefix = (new Date()).toUTCString() + ' | ';
  console.log.apply(console, [prefix].concat(args));*/
  console.log(...arguments);
}

export default logConsole;