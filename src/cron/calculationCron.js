import cron from 'node-cron';
import moment from 'moment-timezone';
import { transactionWrapper } from '../utils/db.js';
import { createCalculationDao } from '../apis/calculation/calculationDao.js';
import { getCalculationforCronDao } from '../apis/calculation/calculationDao.js';
import { getUsersForCronDao } from '../apis/users/userDao.js';

cron.schedule(
  '0 0 * * *',
  () => {
    collectCalculationData('Asia/Kolkata');
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
const collectCalculationData = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  try {
    const users = (await transactionWrapper(getUsersForCronDao)()) || [];
    const usersArray = users || [];
    for (const user of usersArray) {
      try {
        const calculation = await getCalculationforCronDao(user.id);
        if (calculation.length > 0) {
          const resetData = {
            user_id: calculation[0].user_id,
            role_id: calculation[0].role_id,
            company_id: calculation[0].company_id,
            net_balance: calculation[0].net_balance,
            config: calculation[0].config,
          };
          await processUpdate(resetData);
        }
      } catch (userError) {
        console.error(
          `Error processing data for user ${user?.id}:`,
          userError?.message,
        );
      }
    }
    console.info('Cron job executed successfully for all users.', startTime);
  } catch (error) {
    console.error('Error while collecting user data:', error?.message);
  }
};
// Function to update the calculation data
async function processUpdate(data) {
  try {
    await createCalculationDao(null, data);
  } catch (error) {
    console.error('Error while updating calculation data:', error?.message);
  }
}

export default collectCalculationData;
