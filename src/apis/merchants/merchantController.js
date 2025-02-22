import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createMerchantService, deleteMerchantService, getMerchantsService, updateMerchantService } from './merchantService.js';
import { VALIDATE_UPDATE_MERCHANT_STATUS,VALIDATE_MERCHANT_BY_ID,VALIDATE_MERCHANT_SCHEMA } from '../../schemas/merchantSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
const createMerchant = async (req, res) => {
    try {
        let payload = req.body;
        if (!payload) {
          console.error('payload is required');
          return sendError(res, 'payload is required', 'Validation Error');
        }
        const {company_id,user_id,role_id} = req.user;
        payload.company_id=company_id;
        payload.user_id=user_id;
        payload.role_id=role_id;
        const { error } = VALIDATE_MERCHANT_SCHEMA.validate(payload);
        if (error) {
            throw new ValidationError(error);
        }
        // Call the service to create the Merchant
        const result = await createMerchantService(payload);
        // Log success message
        console.log('Merchant created successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Merchant created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating Merchant', error);
        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating Merchant');
    }
};

const getMerchants = async (req, res) => {
    try {
        const {company_id,user_id,role_id} = req.user;
        let search = req.query.search; 
        let user = {}; 
        user.company_id=company_id;
        user.user_id=user_id;
        user.role_id=role_id;
        // Fetch merchants data from the service
        const data = await getMerchantsService(search,user);
        // Log success message
        console.log('get Merchants successfully', data);
        // Send success response
        return sendSuccess(res, data, 'Merchants fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Merchants Data', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Merchants');
    }
};
const getMerchantsById = async (req, res) => {
    try {
        const { error } = VALIDATE_MERCHANT_BY_ID.validate(req.params);
        if (error) {
            return sendError(res, error.details[0].message, 'Validation Error');
        }
        const {id} = req.params;
        const {company_id,user_id,role_id} = req.user;
        // Fetch merchants data from the service
        const data = await getMerchantsService({id,company_id,role_id,user_id});
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
        const { error: paramsError } =VALIDATE_MERCHANT_BY_ID.validate(req.params);
        if (paramsError) {
            return sendError(res, paramsError.details[0].message, 'Validation Error');
        }
        // Validate body (fields for update)
        const { error: bodyError } = VALIDATE_UPDATE_MERCHANT_STATUS.validate(req.body);
        if (bodyError) {
            return sendError(res, bodyError.details[0].message, 'Validation Error');
        }

        const payload = req.body;
        const { id } = req.params;  // Assuming the Merchant ID is passed as a parameter
        const {company_id,user_id,role_id} = req.user;

        // Call the service to update the Merchant
        const result = await updateMerchantService(id,company_id,role_id,user_id, payload);

        // Log success message
        console.log('Merchant updated successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Merchant updated successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while updating Merchant', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating Merchant');
    }
};

const deleteMerchant = async (req, res) => {
    try {
        const { error } = VALIDATE_MERCHANT_BY_ID.validate(req.params);
        if (error) {
            return sendError(res, error.details[0].message, 'Validation Error');
        }
        const { id } = req.params;  // Assuming the Merchant ID is passed as a parameter
        // Call the service to delete the Merchant
        const {company_id,user_id,role_id} = req.user;
        const result = await deleteMerchantService(id,company_id,user_id,role_id);
        // Log success message
        console.log('Merchant deleted successfully',  result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Merchant deleted successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while deleting Merchant', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting Merchant');
    }
};

export { createMerchant, getMerchants, updateMerchant, deleteMerchant ,getMerchantsById};
