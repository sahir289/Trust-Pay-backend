import { getWithDrawByIdDao } from "./withDrawDao.js"

export const getWithdrawByIdService = async (payInId) => {
    const data = await getWithDrawByIdDao(payInId)
    return data
}
