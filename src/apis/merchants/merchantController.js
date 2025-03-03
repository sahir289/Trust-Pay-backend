import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createMerchantService, deleteMerchantService, getMerchantsService, updateMerchantService } from './merchantService.js';
import { VALIDATE_UPDATE_MERCHANT_STATUS, VALIDATE_MERCHANT_BY_ID, VALIDATE_MERCHANT_SCHEMA } from '../../schemas/merchantSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';

const createMerchant = async (req, res) => {
    try {
        const { error } = VALIDATE_MERCHANT_SCHEMA.validate(req.payload);
        if (error) {
            throw new ValidationError(error);
        }
        const { role } = req.user;
        let payload = req.body;
        const {company_id, user_id} = req.user;
        payload.company_id = company_id;
        payload.created_by = user_id;
        payload.updated_by = user_id;
        // Call the service to create the Merchant
        await transactionWrapper(createMerchantService)(payload, role);
        
        // Log success message
        console.log('Merchant created successfully');

        // Send a success response to the client
        return sendSuccess(res,'Merchant created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating Merchant', error);
        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating Merchant');
    }
};

const getMerchants = async (req, res) => {
    try {
        const {company_id,role} = req.user; 
        const data = await getMerchantsService({
            company_id,
            ...req.query,
        }, role);
        console.log('get Merchants successfully');
        return sendSuccess(res, data, 'Merchants fetched successfully');
    } catch (error) {
        console.error('error getting while fetching Merchants Data', error);
        return sendError(res, error, 'Error occurred while fetching Merchants');
    }
};
const getMerchantsById = async (req, res) => {
    try {
        const { role } = req.user;
        const { error } = VALIDATE_MERCHANT_BY_ID.validate(req.params);
        if (error) {
            throw new ValidationError(error);
        }
        const { id } = req.params;
        const { company_id } = req.user;
        // Fetch merchants data from the service
        const data = await getMerchantsService({ id, company_id }, role);
        // Log success message
        console.log('get Merchant successfully', data);

        // Send success response
        return sendSuccess(res, data, 'Merchant fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Merchants Data', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Merchants');
    }
};


const updateMerchant = async (req, res) => {
    try {
        const { error: paramsError } = VALIDATE_MERCHANT_BY_ID.validate(req.params);
        if (paramsError) {
            throw new ValidationError(paramsError);
        }
        // Validate body (fields for update)
        const { error: bodyError } = VALIDATE_UPDATE_MERCHANT_STATUS.validate(req.body);
        if (bodyError) {
            throw new ValidationError(bodyError);
        }
        const payload = req.body;
        const { id } = req.params;  // Assuming the Merchant ID is passed as a parameter
        const {company_id,user_id,role} = req.user;
        payload.updated_by=user_id;
        const ids = {id, company_id}
        // Call the service to update the Merchant
        await updateMerchantService(ids, payload, role);
        // Log success message
        console.log('Merchant updated successfully');

        // Send a success response to the client
        return sendSuccess(res, 'Merchant updated successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while updating Merchant', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating Merchant');
    }
};

const deleteMerchant = async (req, res) => {
    try {
        const { role } = req.user;
        const { error } = VALIDATE_MERCHANT_BY_ID.validate(req.params);
        if (error) {
            throw new ValidationError(error);
        }
        const { id } = req.params;  // Assuming the Merchant ID is passed as a parameter
        // Call the service to delete the Merchant
        const {company_id,user_id} = req.user;
        const updated_by = user_id;
        const ids = {id, company_id}
        await deleteMerchantService(ids,updated_by, role);
        // Log success message
        console.log('Merchant deleted successfully');

        // Send a success response to the client
        return sendSuccess(res, 'Merchant deleted successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while deleting Merchant', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting Merchant');
    }
};

export { createMerchant, getMerchants, updateMerchant, deleteMerchant, getMerchantsById };
