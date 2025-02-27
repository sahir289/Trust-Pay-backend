import cron from 'node-cron';
import moment from 'moment-timezone';
import { getCalculationDao} from '../apis/calculation/calculationDao.js';
import { transactionWrapper } from '../utils/db.js';


const getUsersForCron = async (conn) => {
  try {
    const sql = `SELECT id  FROM public."User" where is_obsolete = false`;
    const result = await conn.query(sql);
    if (result.rows.length === 0) {
      console.error('No users Found');
      return [];
    }
    return result.rows;
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};

// cron.schedule('*/5 * * * * *', () => {
//     collectCalculationData('Asia/Kolkata');
// });
cron.schedule("0 0 * * *", () => {
    collectCalculationData('Asia/Kolkata')
},{
    timezone: 'Asia/Kolkata' 
}
);

const collectCalculationData = async (timezone = 'Asia/Kolkata') => {
    const startTime = moment().tz(timezone, true);
    // const updatedTime = startTime.subtract(24, 'hours')
    try {
        const users = (await transactionWrapper(getUsersForCron)()) || [];
        const usersArray = users || [];
        for (const user of usersArray) {
            try {
                const calculation = await getCalculationDao({ user_id: user.id});
                if (calculation) {
                    const resetData = {
                        user_id: calculation.user_id,
                        role_id: calculation.role_id,
                        company_id: calculation.company_id,
                        total_payin_count: 0,
                        total_payin_amount: 0,
                        total_payin_commission: 0,
                        total_payout_count: 0,
                        total_payout_amount: 0,
                        total_payout_commission: 0,
                        total_settlement_count: 0,
                        total_settlement_amount: 0,
                        total_chargeback_count: 0,
                        total_chargeback_amount: 0,
                        net_balance: calculation.net_balance,
                        current_balance: 0,
                        total_reverse_payout_amount: 0,
                        total_reverse_payout_count: 0,
                        total_reverse_payout_commission: 0,
                        config: {},
                    };
                console.log(resetData)
                    // await processUpdate(resetData);
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
// async function processUpdate(data) {
//     console.log(data,"hii from data")
//     try {
//        await createCalculationDao(data, null);
//     } catch (error) {
//         console.error('Error while updating calculation data:', error?.message);
//     }
// }

export default collectCalculationData;
