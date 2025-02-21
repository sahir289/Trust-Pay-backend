import cron from 'node-cron';
import moment from 'moment-timezone';
import { getCalculationDao, createCalculationDao } from '../apis/calculation/calculationDao.js';
import { getUsersDao } from '../apis/users/userDao.js';
import { getConnection } from '../utils/db.js';


cron.schedule("0 0 * * *", () => {
    collectCalculationData('Asia/Kolkata');
},{
    timezone: 'Asia/Kolkata' 
});

const collectCalculationData = async (timezone = 'Asia/Kolkata') => {
    const startTime = moment().tz(timezone, true);
    let conn;
    try {
        conn = await getConnection();
    } catch (error) {
        console.error('Error while connecting to the database:', error?.message);
        return;
    }

    try {
        const users = (await getUsersDao(conn)) || [];
        const usersArray = users?.users || users?.data || [];

        for (const user of usersArray) {
            try {
                const calculation = await getCalculationDao({ user_id: user?.id });
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
    } finally {
        // Ensuring connection is closed after the process
        if (conn) {
            try {
                conn.release();
            } catch (releaseError) {
                console.error('Error releasing DB connection:', releaseError?.message);
            }
        }
    }
};

// Function to update the calculation data
async function processUpdate(data) {
    try {
        await createCalculationDao(data, null);
    } catch (error) {
        console.error('Error while updating calculation data:', error?.message);
    }
}

export default collectCalculationData;
