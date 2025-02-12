import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { getAllPayoutDao ,getAllVendorAccountReportDao } from './reportsDao.js';

const logger = new Logger();

const getAllPayoutService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        let { merchantCode, vendorCode, status, startDate, endDate, method} = payload;
        merchantCode = merchantCode ? (Array.isArray(merchantCode) ? merchantCode : [merchantCode]) : [];
        vendorCode = vendorCode ? (Array.isArray(vendorCode) ? vendorCode : [vendorCode]) : [];

        if (vendorCode.length > 0) {
            // console.log("vendor code");
            const data = await getAllPayoutDao(conn, { Code: vendorCode, status, startDate, endDate, method });
            logger.log('Vendor Payout fetched successfully', 'info');
            return data;
        } else {
            // console.log("merchant code");
            // if (merchantCode.length > 0) {
            //     let allMerchantCodes = [...merchantCode];
            //     // if (includeSubMerchant) {
            //     //     console.log("submerchant");
            //     //     for (const code of merchantCode) {
            //     //         const query = `
            //     //             SELECT child_code
            //     //             FROM Public.Payout
            //     //             WHERE merchant_code = $1
            //     //         `;
            //     //         const result = await conn.query(query, [code]);

            //             if (result.rows.length > 0) {
            //                 const childCodes = result.rows.map(row => row.child_code);
            //                 allMerchantCodes.push(...childCodes);
            //             }
            //         }
            //     }
              const ismerchant = true;
                const data = await getAllPayoutDao(conn, { Code: merchantCode, status, startDate, endDate, method,ismerchant });
                logger.log('Merchant Payout fetched successfully', 'info');
                return data;
            } 
        
    } catch (error) {
        logger.log('Error while fetching payouts', 'error', error);
        throw new BadRequestError('Error occurred while fetching payout data.');
    } finally {
        if (conn) {
            try {
                conn.release(); 
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};
const getAllVendorAccountReportService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        let { id, startDate, endDate } = payload;
            if (id == null) {
                id = [];
            } else if (typeof id === "string") {
                id = [id];
            }
            const weeklyReport = await getAllVendorAccountReportDao(conn,{id,
                startDate,
                endDate});
           console.log(weeklyReport);       
        }
     catch (error) {
        logger.log('Error while fetching payouts', 'error', error);
        throw new BadRequestError('Error occurred while fetching payout data.');
    } finally {
        if (conn) {
            try {
                conn.release(); 
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
}


export { getAllPayoutService , getAllVendorAccountReportService };
