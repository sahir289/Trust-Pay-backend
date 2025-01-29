import Logger from '../../utils/logger.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createVendoService, deleteVendorService, getVendorsService, updateVendorService } from './vendorService.js';

const logger = new Logger();

const createChargeBack = async (req, res) => {
    try {
        const payload = req.body;

        // Call the service to create the ChargeBack
        const result = await createVendoService(payload);

        // Log success message
        logger.log('ChargeBack created successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack created successfully');
    } catch (error) {
        // Log the error
        logger.log('error getting while creating ChargeBack', 'error', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating ChargeBack');
    }
};

const getChargeBacks = async (req, res) => {
    try {
        const payload = req.body;

        // Fetch vendors data from the service
        const data = await getVendorsService(payload);

        // Log success message
        logger.log('getChargeBacks successfully', 'info', data);

        // Send success response
        return sendSuccess(res, data, 'ChargeBacks fetched successfully');
    } catch (error) {
        // Log error
        logger.log('error getting while fetching ChargeBacks Data', 'error', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching ChargeBacks');
    }
};

const updateChargeBack = async (req, res) => {
    try {
        const payload = req.body;
        const { id } = req.params;  // Assuming the ChargeBack ID is passed as a parameter

        // Call the service to update the ChargeBack
        const result = await updateVendorService(id, payload);

        // Log success message
        logger.log('ChargeBack updated successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack updated successfully');
    } catch (error) {
        // Log the error
        logger.log('error occurred while updating ChargeBack', 'error', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating ChargeBack');
    }
};

const deleteChargeBack = async (req, res) => {
    try {
        const { id } = req.params;  // Assuming the ChargeBack ID is passed as a parameter

        // Call the service to delete the ChargeBack
        const result = await deleteVendorService(id);

        // Log success message
        logger.log('ChargeBack deleted successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack deleted successfully');
    } catch (error) {
        // Log the error
        logger.log('error occurred while deleting ChargeBack', 'error', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting ChargeBack');
    }
};

export { createChargeBack, getChargeBacks, updateChargeBack, deleteChargeBack };
