// Function to calculate balances based on role
export const calculateBalances = (calc, prevCalc, isMerchant) => {
    const baseCalculation = calc.total_payin_amount - calc.total_payout_amount - (calc.total_payin_commission - calc.total_payout_commission + calc.total_reverse_payout_commission) - calc.total_chargeback_amount + calc.total_reverse_payout_amount;
    return {
        currentBalance: isMerchant ? baseCalculation - calc.total_settlement_amount : baseCalculation + calc.total_settlement_amount,
        netBalance: prevCalc.net_balance + baseCalculation + (isMerchant ? -calc.total_settlement_amount : calc.total_settlement_amount)
    };
};
