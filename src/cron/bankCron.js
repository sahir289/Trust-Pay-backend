import cron from 'node-cron';
import moment from 'moment-timezone';
import {getBankaccountDao,updateBankaccountDao} from '../apis/bankAccounts/bankaccountDao.js';
import { getUsersDao } from '../apis/users/userDao.js';
import { getConnection } from '../utils/db.js';

// Scheduling the cron job to run every day at 6:30 PM (Asia/Kolkata timezone)
cron.schedule("0 0 * * *", () => {
    collectBankData('Asia/Kolkata');
},{
    timezone: 'Asia/Kolkata' 
});

// Main function to collect and process calculation data
const collectBankData = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  let conn;
  try {
    // Establishing DB connection
    conn = await getConnection();
  } catch (error) {
    console.error('Error while connecting to the database:', error?.message);
    return;
  }

  try {
    // Fetching users from the database
    const users = (await getUsersDao(conn)) || [];
    const usersArray = users?.users || users?.data || [];

    // Processing each user
    for (const user of usersArray) {
      try {
        // Fetching existing calculation data for the user
        // const banks = await getBankaccountDao({
        //   id: '7410954c-8014-4827-a70e-740fcb0c4189',
        // });
        const banks = await getBankaccountDao({ user_id: user?.id });
        if (Array.isArray(banks) && banks.length > 0) {
          // Loop through each bank object
          banks.forEach(async (bank) => {
            const Data = {
              today_balance: 0,
            };
            // Log the created data
            await processUpdate(bank?.id, Data, conn);

            // Further processing or saving to DB (e.g., calling processUpdate(Data))
          });
        } else {
          return;
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
async function processUpdate(id, data, conn) {
  try {
    await updateBankaccountDao(id, data, conn);
  } catch (error) {
    console.error('Error while updating calculation data:', error?.message);
  }
}

export default collectBankData;
