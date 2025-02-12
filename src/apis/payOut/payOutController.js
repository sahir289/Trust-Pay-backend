import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createPayoutService, deletePayoutService, getPayoutsService, updatePayoutService } from './payOutService.js';

const createPayout = async (req, res) => {
    try {
        const payload = req.body;

        // Call the service to create the Vendor
        const result = await createPayoutService(payload);

        // Log success message
        console.log('Vendor created successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Vendor created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating Vendor', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating Vendor');
    }
};

const getPayouts = async (req, res) => {
    try {
        const { payload } = req.query;

        // Fetch vendors data from the service
        const data = await getPayoutsService(payload);

        // Log success message
        console.log('getvendors successfully', data);

        // Send success response
        return sendSuccess(res, data, 'Vendors fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Vendors Data',  error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Vendors');
    }
};

const updatePayout = async (req, res) => {
    try {
        const payload = req.body;
        const { id } = req.params;  // Assuming the Vendor ID is passed as a parameter

        // Call the service to update the Vendor
        const result = await updatePayoutService(id, payload);

        // Log success message
        console.log('Vendor updated successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Vendor updated successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while updating Vendor', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating Vendor');
    }
};

const deletePayout = async (req, res) => {
    try {
        const { id } = req.params;  // Assuming the Vendor ID is passed as a parameter

        // Call the service to delete the Vendor
        const result = await deletePayoutService(id);

        // Log success message
        console.log('Vendor deleted successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Vendor deleted successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while deleting Vendor', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting Vendor');
    }
};

export { createPayout, getPayouts, updatePayout, deletePayout };
