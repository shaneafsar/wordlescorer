/**
 * 1. This function takes an argument called delayedFunc
 * 2. It then creates a new Date object called finalTime, and sets the time to the top of the next day
 * 3. Then it creates a new Date object called currentDate, and gets the current time in milliseconds
 * 4. Then it logs a message to the console that says how many hours until the final score
 * @param {function} delayedFunc 
 * @returns {NodeJS.Timeout}
 */
export function setDelayedFunction(delayedFunc) {
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
 * @param {function} delayedFunc - The function to execute.
 * @returns {Promise<void>}
 */
export function setDelayedFunctionWithPromise(delayedFunc) {
    return new Promise((resolve, reject) => {
        const finalTime = new Date().setUTCHours(24, 0, 0, 0);
        const currentDate = new Date();
        const currentTime = currentDate.getTime();
        console.log(`\n *** \n ${delayedFunc.name} happening in about ${((finalTime - currentTime) / 1000 / 60 / 60).toFixed(2)} hours \n *** \n`);

        setTimeout(async () => {
            try {
                await delayedFunc(currentDate);
            } catch(error) {
                console.error(`\n *** \n ${delayedFunc.name} failed with error: ${error} \n *** \n`);
                reject(error); // Reject the promise on error
                return;
            }
            resolve(); // Ensure the promise resolves after the function runs
        }, finalTime - currentTime);
    });
}
