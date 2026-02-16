/**
 * Schedules a function to run at the top of the next UTC day.
 */
export function setDelayedFunction(delayedFunc: (date: Date) => void): NodeJS.Timeout {
  const finalTime = new Date().setUTCHours(24, 0, 0, 0);
  const currentDate = new Date();
  const currentTime = currentDate.getTime();
  console.log(`\n *** \n ${delayedFunc.name} happening in about ${((finalTime - currentTime) / 1000 / 60 / 60).toFixed(2)} hours \n *** \n`);
  return setTimeout(() => {
    delayedFunc(currentDate);
  }, finalTime - currentTime);
}

/**
 * Schedules a delayed function and returns a Promise that resolves when the function completes.
 */
export function setDelayedFunctionWithPromise(delayedFunc: (date: Date) => void | Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const finalTime = new Date().setUTCHours(24, 0, 0, 0);
    const currentDate = new Date();
    const currentTime = currentDate.getTime();
    console.log(`\n *** \n ${delayedFunc.name} happening in about ${((finalTime - currentTime) / 1000 / 60 / 60).toFixed(2)} hours \n *** \n`);

    setTimeout(async () => {
      try {
        await delayedFunc(currentDate);
      } catch (error) {
        console.error(`\n *** \n ${delayedFunc.name} failed with error: ${error} \n *** \n`);
        reject(error);
        return;
      }
      resolve();
    }, finalTime - currentTime);
  });
}
