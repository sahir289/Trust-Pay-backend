import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createMerchantService, deleteMerchantService, getMerchantsService, updateMerchantService } from './merchantService.js';


const createMerchant = async (req, res) => {
    try {
        const payload = req.body;

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
        const payload = req.query.search;

        // Fetch merchants data from the service
        const data = await getMerchantsService(payload);

        // Log success message
        console.log('getMerchants successfully', data);

        // Send success response
        return sendSuccess(res, data, 'Merchants fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Merchants Data', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Merchants');
    }
};

const updateMerchant = async (req, res) => {
    try {
        const payload = req.body;
        const { id } = req.params;  // Assuming the Merchant ID is passed as a parameter

        // Call the service to update the Merchant
        const result = await updateMerchantService(id, payload);

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
        const { id } = req.params;  // Assuming the Merchant ID is passed as a parameter

        // Call the service to delete the Merchant
        const result = await deleteMerchantService(id);

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

export { createMerchant, getMerchants, updateMerchant, deleteMerchant };
