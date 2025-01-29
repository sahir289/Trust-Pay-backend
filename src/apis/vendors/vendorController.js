import Logger from '../../utils/logger.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createVendorService, deleteVendorService, getVendorsService, updateVendorService } from './vendorService.js';

const logger = new Logger();

const createVendor = async (req, res) => {
    try {
        const payload = req.body;

        // Call the service to create the Vendor
        const result = await createVendorService(payload);

        // Log success message
        logger.log('Vendor created successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Vendor created successfully');
    } catch (error) {
        // Log the error
        logger.log('error getting while creating Vendor', 'error', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating Vendor');
    }
};

const getVendors = async (req, res) => {
    try {
        const payload = req.body;

        // Fetch vendors data from the service
        const data = await getVendorsService(payload);

        // Log success message
        logger.log('getvendors successfully', 'info', data);

        // Send success response
        return sendSuccess(res, data, 'Vendors fetched successfully');
    } catch (error) {
        // Log error
        logger.log('error getting while fetching Vendors Data', 'error', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Vendors');
    }
};

const updateVendor = async (req, res) => {
    try {
        const payload = req.body;
        const { id } = req.params;  // Assuming the Vendor ID is passed as a parameter

        // Call the service to update the Vendor
        const result = await updateVendorService(id, payload);

        // Log success message
        logger.log('Vendor updated successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Vendor updated successfully');
    } catch (error) {
        // Log the error
        logger.log('error occurred while updating Vendor', 'error', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating Vendor');
    }
};

const deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;  // Assuming the Vendor ID is passed as a parameter

        // Call the service to delete the Vendor
        const result = await deleteVendorService(id);

        // Log success message
        logger.log('Vendor deleted successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Vendor deleted successfully');
    } catch (error) {
        // Log the error
        logger.log('error occurred while deleting Vendor', 'error', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting Vendor');
    }
};

export { createVendor, getVendors, updateVendor, deleteVendor };
