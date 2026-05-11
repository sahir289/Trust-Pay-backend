import redisClient from '../utils/redisClient.js';
import { CALCULATION_LOCK } from '../utils/constants.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForCronMiddleware = async (req, res, next) => {
  try {
    let isCronRunning = await redisClient.get(CALCULATION_LOCK);

    let retry = 0;
    const maxRetry = 30; // 30 sec wait

    while (isCronRunning && retry < maxRetry) {
      console.log('Waiting for cron to finish...');

      await sleep(1000);

      isCronRunning = await redisClient.get(CALCULATION_LOCK);

      retry++;
    }

    if (retry >= maxRetry) {
      return res.status(408).json({
        success: false,
        message: 'Server busy. Try again later.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};




// // calculationLockMiddleware.js

// import redisClient from '../utils/redisClient.js';
// import { CALCULATION_LOCK } from '../utils/constants.js';

// export const blockDuringCalculation = async (
//   req,
//   res,
//   next,
// ) => {
//   try {
//     const isLocked = await redisClient.get(CALCULATION_LOCK);

//     if (isLocked) {
//       return res.status(503).json({
//         success: false,
//         message:
//           'System calculation cron is running. Please try again later.',
//       });
//     }

//     next();
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: 'Redis check failed',
//       error: error.message,
//     });
//   }
// };