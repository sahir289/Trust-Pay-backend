import cron from 'node-cron';
import moment from 'moment-timezone';
import { 
  // executeQuery, 
  transactionWrapper 
} from '../utils/db.js';
import { createCalculationDao } from '../apis/calculation/calculationDao.js';
import { getCalculationforCronDao } from '../apis/calculation/calculationDao.js';
import { getUsersForCronDao } from '../apis/users/userDao.js';
// import { Role, tableName } from '../constants/index.js';
// import dayjs from 'dayjs';

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

// add users in calculation table if user table is empty
// (async () => {
//   try {
//     const roles = [Role.ADMIN, Role.MERCHANT, Role.VENDOR].map(el=> `'${el}'`).join(", ")
//     const userQuery = `select u.id, r.id as role_id, u.company_id from "${tableName.USER}" u
//     join "${tableName.ROLE}" r on u.role_id = r.id AND r.role = ANY(ARRAY[${roles}])
//     where u.is_obsolete = false`;
//     // console.log(userQuery);
//     // add other roles if necessary
//     const users = await executeQuery(userQuery, []);

//     for (const user of users.rows) {
//       try {
//         const existQuery = `Select c.id from "${tableName.CALCULATION}" c where c.user_id = $1 AND c.created_at::DATE = '${dayjs().format("YYYY-MM-DD")}'`
//         // console.log(existQuery);
//         const isExist = await executeQuery(existQuery, [user.id]);
//         if (isExist.rowCount) {
//           console.log("Entry already exist for user_id", user.id, isExist.rows[0].created_at);
//           continue;
//         }

//         await createCalculationDao(null, {
//           role_id: user.role_id,
//           user_id: user.id,
//           company_id: user.company_id,
//         })
//       } catch (err) {
//         console.log("Error for user", user.id, err.message);
//       }
//     }
//   } catch (err) {
//     console.log(err);
//   }
// })()