import cron from "node-cron";
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getPayinsDao } from "../apis/payIn/payInDao.js";
import { getCalculationDao } from "../apis/calculation/calculationDao.js";
import { getPayoutsDao } from "../apis/payOut/payOutDao.js";
// import moment from "moment-timezone";
import { getUserHierarchysDao } from "../apis/userHierarchy/userHierarchyDao.js";
import { getBankaccountDao } from "../apis/bankAccounts/bankaccountDao.js";
import { getChargeBackDao } from "../apis/chargeBacks/chargeBackDao.js";
import { sendTelegramDashboardMerchantGroupingReportMessage, sendTelegramDashboardReportMessage, sendTelegramDashboardSuccessRatioMessage } from "../utils/sendTelegramMessages.js";
import config from "../config.js";
import { getSettlementDao } from "../apis/settlement/settlementDao.js";

cron.schedule("* * * * *", () => {
    gatherAllData("Asia/Kolkata");
});

// cron.schedule("0 1-23 * * *", () => {
//     gatherAllData("H", "Asia/Kolkata");
// });

const gatherAllData = async (timezone = "Asia/Kolkata") => {
    try {
        if (typeof timezone !== "string") {
            timezone = "Asia/Kolkata";
        }

        // const currentDate = moment().tz(timezone, true);

        //   if (type === "H") {
        //     startDate = currentDate.clone().startOf("day").toDate(); // Start of today at 12 AM
        //     endDate = currentDate.clone().toDate(); // Current time
        //     oneHourAgo = currentDate.clone().subtract(1, "hour").toDate();
        //   }

        //   if (type === "N") {
        //     startDate = currentDate
        //       .clone()
        //       .subtract(1, "day")
        //       .startOf("day")
        //       .toDate(); // Start of yesterday
        //     endDate = currentDate.clone().subtract(1, "day").endOf("day").toDate(); // End of yesterday at 11:59 PM
        //   }
        console.log("cron started")
        const merchants = await getMerchantsDao({});
        const payins = await getPayinsDao({ status: "SUCCESS" });
        let payInSum = 0;
        // let payIn = 0;
        // let payInEachCount = 0;
        let payInCount = 0;
        let merchant = [];
        let configs = [];
        for (const payin of payins) {
            const userId = await getMerchantsDao({ id: payin.merchant_id })
           
            const groupMerchants = await getUserHierarchysDao({
                user_id: userId[0].user_id
            });
            if (groupMerchants.length > 0) {
                for (let groupmerchant of groupMerchants) {
                    const config = groupmerchant.config;
                    configs.push({ config: config });
                    const values = Object.values(config).flat();

                    for (let value of values) {
                        const merchantData = await getMerchantsDao({ user_id: value });
                        const totalPayindataArray = await getCalculationDao({ user_id: value });
                    
                        console.log("totalPayindataArray for user_id:", value, totalPayindataArray);
                    
                        if (Array.isArray(totalPayindataArray) && totalPayindataArray.length > 0) {
                            for (const totalPayindata of totalPayindataArray) {
                                console.log("totalPayindata.total_payin_amount:", totalPayindata.total_payin_amount);
                                console.log("totalPayindata.total_payin_count:", totalPayindata.total_payin_count);
                    
                                payInSum += totalPayindata.total_payin_amount || 0;
                                payInCount += totalPayindata.total_payin_count || 0;
                    
                                console.log("Updated payInSum:", payInSum);
                                console.log("Updated payInCount:", payInCount);
                            }
                        }
                    
                        merchant.push({
                            merchantId: merchantData[0].code,
                            payInSum,
                            payInCount,
                        });
                    
                        console.log(merchant, payInSum, payInCount, "drxfcgvjhh");
                    }
                }

            }
        }

        const totalPayins = await getPayinsDao({ status: "SUCCESS" });
        let totalPayInSum = 0;
        let totalPayInCount = 0;
        let totalPayInEachCount = 0;
        let totalPayIn = 0;
        let totalPayinsMerchant = [];

        for (const totalPayin of totalPayins) {
            const userId = await getMerchantsDao({ id: totalPayin.merchant_id })
                for(let userid of userId){
                const totalPayindataArray = await getCalculationDao({ user_id: userId.user_id });
                if (Array.isArray(totalPayindataArray) && totalPayindataArray.length > 0) {
                    for (const totalPayindata of totalPayindataArray) {
                        totalPayInSum += totalPayindata.total_payin_amount || 0;
                        totalPayInCount += totalPayindata.total_payin_count || 0;
                        totalPayIn = totalPayindata.total_payin_amount || 0;
                        totalPayInEachCount = totalPayindata.total_payin_count || 0;
                    }
                }
                
               
                totalPayinsMerchant.push({
                    merchantId: userid.code,
    
                    totalPayIn,
                    totalPayInEachCount
                });
            }
        
        }
       

        const payouts = await getPayoutsDao({ status: "SUCCESS" });
        let payOutSum = 0;
        let payOutCount = 0;
        // let payOut = 0;
        // let payOutCountEach = 0;
        let payoutconfigs = [];
        let merchantpayout = []
        for (const payout of payouts) {
            const userId = await getMerchantsDao({ id: payout.merchant_id })
            // for (let userid of userId) {

                const groupMerchants = await getUserHierarchysDao({
                    user_id: userId[0].user_id
                });
                if (groupMerchants.length > 0) {
                    for (let groupmerchant of groupMerchants) {
                        const config = groupmerchant.config;
                        payoutconfigs.push({ config: config });
                        const values = Object.values(config).flat();
                        for (let value of values) {
                            const merchant_id = await getMerchantsDao({ user_id: value })

                            const totalPayoutdataArray = await getCalculationDao({ user_id: value });
                            if (Array.isArray(totalPayoutdataArray) && totalPayoutdataArray.length > 0) {
                                for (const totalPayindata of totalPayoutdataArray) {
                                    payOutSum += totalPayindata.total_payout_amount || 0;
                                    payOutCount += totalPayindata.total_payout_count || 0;
                                    // payOut = totalPayindata.total_payout_amount || 0;
                                    // payOutCountEach = totalPayindata.total_payout_count || 0;
                                }
                            }
                            merchantpayout.push({
                                merchantId: merchant_id[0].code,
                                payOutSum,
                                payOutCount
                            });
                        }
                    }
                }
            
        } 
        const totalPayouts = await getPayinsDao({ status: "SUCCESS" });
        let totalPayOutSum = 0;
        let totalPayOutCount = 0;
        // let totalPayOutEach = 0;
        // let totalPayOutCountEach = 0;
        let merchantTotalPayout = []
        for (const totalPayout of totalPayouts) {
            const userId = await getMerchantsDao({ id: totalPayout.merchant_id })
            for (let userid of userId) {
                const totalPayoutdataArray = await getCalculationDao({ user_id: userid.user_id });
                if (Array.isArray(totalPayoutdataArray) && totalPayoutdataArray.length > 0) {
                    for (const totalPayoutdata of totalPayoutdataArray) {
                        totalPayOutSum += totalPayoutdata.total_payin_amount || 0;
                        totalPayOutCount += totalPayoutdata.total_payin_count || 0;
                        // totalPayOutEach = totalPayoutdata.total_payin_amount || 0;
                        // totalPayOutCountEach = totalPayoutdata.total_payin_count || 0;
                    }
                }
                merchantTotalPayout.push({
                    merchantId: userid.code,
                    totalPayOutSum,
                    totalPayOutCount
                });
            }
        }
        let payInBanks = await getBankaccountDao({ bank_used_for: "payIn" })

        let payInBanksdata = [];
        if (Array.isArray(payInBanks)) {
            for (let payInBank of payInBanks) {
                payInBanksdata.push({
                    bankID: payInBank.id,
                    payInBalance: payInBank.balance,
                    payInToday: payInBank.today_balance
                });
            }
        }
        // else {
        //     console.log("no payin banks data")
        // }
        let payOutBanks = await getBankaccountDao({ bank_used_for: "payOut" })
        let payOutBanksdata = [];
        if (Array.isArray(payOutBanks) && payOutBanks.length > 0) {
            payOutBanksdata = payOutBanks.map(payoutbank => ({
                payoutbankId: payoutbank.id,
                payoutbankBalance: payoutbank.balance,
                payoutbankToday: payoutbank.today_balance
            }));
        }else {
            console.log("no payiout banks data")
        }
        let settlements = await getSettlementDao({})
        let settlementdata = [];
        if (settlements) {
            for (let settlement of settlements) {

                settlementdata.push({
                    settlementdataId: settlement.id,
                    settlementdataBalance: settlement.amount,
                })
            }
        }
        else {
            console.log("no settlement banks data")

        }
        let chargebacks = await getChargeBackDao({})
        let chargebackData = [];
        if (chargebacks) {
            for (let chargeback of chargebacks) {

                chargebackData.push({
                    chargebackDataID: chargeback.id,
                    chargebackDataBalance: chargeback.amount,
                    chargebackDataToday: chargeback.when,
                    chargeBank: chargeback.bank_acc_id
                });
            }
        }
        else {
            console.log("no settlement banks data")

        }


        const formattedSuccessRatiosByMerchant = async () => {
            try {
                const now = new Date();
                const intervals = [
                    { label: "Last 5m", duration: 5 * 60 * 1000 },
                    { label: "Last 15m", duration: 15 * 60 * 1000 },
                    { label: "Last 30m", duration: 30 * 60 * 1000 },
                    { label: "Last 1h", duration: 60 * 60 * 1000 },
                    { label: "Last 3h", duration: 3 * 60 * 60 * 1000 },
                    { label: "Last 24h", duration: 24 * 60 * 60 * 1000 },
                ];

                // fetch all transactions
                const allPayins = await getPayinsDao({})
                // group transactions by merchant_id
                const transactionsByMerchant = allPayins.reduce((map, payin) => {
                    if (!map[payin.merchant_id]) map[payin.merchant_id] = [];
                    map[payin.merchant_id].push({
                        updated_at: new Date(payin.updated_at),
                        status: payin.status,
                        user_submitted_utr: payin.user_submitted_utr,
                    });
                    return map;
                }, {});

                const merchantsWithTransactions = merchants.filter(
                    (merchant) => Array.isArray(transactionsByMerchant[merchant.id]) &&
                        transactionsByMerchant[merchant.id].length > 0
                );


                // Check transactions for each merchant
                merchants.forEach((merchant) => {
                    const transactions = transactionsByMerchant[merchant.id];
                    if (!transactions) {
                        console.log(merchant.id, "has no transactions available.");
                    } else {
                        console.log( "transactions for merchant");
                    }
                });


                const fullMessages = [];
                // process only merchants with transactions available
                for (const merchant of merchantsWithTransactions) {
                    const merchantTransactions = transactionsByMerchant[merchant.id];

                    const intervalDetails = intervals
                        .map(({ label, duration }) => {
                            const startTime = new Date(now - duration);

                            const filteredTransactions = merchantTransactions.filter(
                                (tx) => tx.updatedAt >= startTime
                            );

                            const total = filteredTransactions.length;
                            const success = filteredTransactions.filter(
                                (tx) => tx.status === "SUCCESS"
                            ).length;

                            const successRatio =
                                total === 0 ? "0.00%" : Math.min(((success / total) * 100).toFixed(2), 100) + "%";
                            const statusIcon = success === 0 ? "⚠️" : "✅";

                            return `${statusIcon} ${label}: ${success}/${total} = ${successRatio}`;
                        })
                        .join("\n")

                    const intervalDetailsUtr = intervals
                        .map(({ label, duration }) => {
                            const startTime = new Date(now - duration);

                            const filteredTransactions = merchantTransactions.filter(
                                (tx) => tx.updatedAt >= startTime
                            );

                            const total = filteredTransactions.length;

                            const utrSubmission = filteredTransactions.filter(
                                (tx) => tx.user_submitted_utr && tx.user_submitted_utr.length > 0
                            ).length;

                            const statusIcon = utrSubmission === 0 ? "⚠️" : "✅";

                            const utrSubmissionRatio =
                                total === 0 ? "0.00%" : Math.min(((utrSubmission / total) * 100).toFixed(2), 100) + "%";

                            return `${statusIcon} ${label}: ${utrSubmission}/${total} = ${utrSubmissionRatio}`;
                        })
                        .join("\n")

                    const fullMessage = {
                        merchantCode: merchant.code,
                        intervalDetails,
                        intervalDetailsUtr
                    }
                    fullMessages.push(fullMessage)
                }
                await sendTelegramDashboardSuccessRatioMessage(
                    config?.telegramRatioAlertsChatId,
                    fullMessages,
                    config?.telegramBotToken
                );

                await sendTelegramDashboardReportMessage(
                    config?.telegramDashboardChatId,
                    merchant,
                    merchantpayout,
                    settlementdata,
                    chargebackData,
                    payInBanksdata,
                    payOutBanksdata,
                    // formatePrice(totalPayInSum),
                    // formatePrice(totalPayInCount),
                    // formatePrice(totalPayOutSum),
                    // formatePrice(totalPayOutCount),
                    // formatePrice(payInBanks),
                    // formatePrice(payOutBanks),
                    // formatePrice(settlements),
                    // formatePrice(chargebacks),
                    // type === "H" ? "Hourly Report" : "Daily Report",
                    totalPayInSum,
                    totalPayInCount,
                    totalPayOutSum,
                    totalPayOutCount,
                    payInBanks,
                    payOutBanks,
                    settlements,
                    chargebacks,

                    config?.telegramBotToken,
                );

                await sendTelegramDashboardMerchantGroupingReportMessage(
                   

                    config?.telegramDashboardMerchantGroupingChatId,
                    // formatePrice(payInSum),
                    // formatePrice(payOutSum),
                    // formatePrice(payInCount),
                    // formatePrice(payOutCount),
                    // type === "H" ? "Hourly Report" : "Daily Report",
                    totalPayInSum,
                    totalPayOutSum,
                    totalPayInCount,
                    totalPayOutCount,
                    totalPayinsMerchant,
                    merchantTotalPayout,

                    config?.telegramBotToken,
                   
                );
            } catch (error) {
                console.error("Error ", error.message);
            }
        };
        formattedSuccessRatiosByMerchant();
    }
    catch {
        console.log()
    }
    // const formatePrice = (price, currencySymbol = "₹") => {
    //     const numericPrice = Number(price);
    //     if (isNaN(numericPrice)) {
    //         console.error("Invalid price:", price);
    //         return `${currencySymbol} 0.00`; // Return default value to avoid errors
    //     }
    //     return `${currencySymbol} ${Number(price).toLocaleString("en-US", {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2,
    //     })}`;
    // };

}



export default gatherAllData;
