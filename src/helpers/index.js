// Function to calculate balances based on role
export const calculateBalances = (calc, prevCalc, isMerchant) => {
    const baseCalculation = calc.total_payin_amount - calc.total_payout_amount - (calc.total_payin_commission - calc.total_payout_commission + calc.total_reverse_payout_commission) - calc.total_chargeback_amount + calc.total_reverse_payout_amount;
    return {
        currentBalance: isMerchant ? baseCalculation - calc.total_settlement_amount : baseCalculation + calc.total_settlement_amount,
        netBalance: prevCalc.net_balance + baseCalculation + (isMerchant ? -calc.total_settlement_amount : calc.total_settlement_amount)
    };
};

export const calculateCommission = (amount, percentage) => {
    return (amount * percentage) / 100;
};


export const calculateDuration = (createdAt) => {
    const durMs = new Date() - createdAt;
    const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
    const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
    const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
    const duration = `${durHours}:${durMinutes}:${durSeconds}`;
    return duration;
}