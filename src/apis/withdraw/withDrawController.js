import { WITHDRAW_BY_ID_SCHEMA } from '../../schemas/WithDrawSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getWithdrawByIdService } from "./withDrawService.js";

//  To Generate Url
export const getWithdrawById = async (req, res) => {
    const joiValidation = WITHDRAW_BY_ID_SCHEMA.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const { payInId } = req.params
    const data = await getWithdrawByIdService(payInId)
    sendSuccess(res, data);
}