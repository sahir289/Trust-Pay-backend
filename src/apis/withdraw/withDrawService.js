import { getWithDrawByIdDao } from "./withDrawDao"

export const getWithdrawByIdService = async (payInId) => {
    const data = await getWithDrawByIdDao(payInId)
    return data
}
