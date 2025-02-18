import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createChargeBackService, getChargeBacksService, updateChargeBackService, deleteChargeBackService} from './chargeBackService.js';


const createChargeBack = async (req, res) => {
    try {
        const payload = req.body;

        // Call the service to create the ChargeBack
        const result = await createChargeBackService(payload);

        // Log success message
        console.log('ChargeBack created successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating ChargeBack', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating ChargeBack');
    }
};

const getChargeBacksById = async (req, res) => {
    try {
        const {id} = req.params;

        // Call the service to create the ChargeBack
        const result = await getChargeBacksService({id:id});

        // Log success message
        console.log('ChargeBack created successfully', 'info', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating ChargeBack', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating ChargeBack');
    }
};


const getChargeBacks = async (req, res) => {
    try {
        const payload = req.query.search;

        // Fetch vendors data from the service
        const data = await getChargeBacksService(payload);

        // Log success message
        console.log('get ChargeBacks successfully', data);

        // Send success response
        return sendSuccess(res, data, 'ChargeBacks fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching ChargeBacks Data', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching ChargeBacks');
    }
};

const updateChargeBack = async (req, res) => {
    try {
        const payload = req.body;
        const { id } = req.params;  
         
        // Call the service to update the ChargeBack
        const result = await updateChargeBackService(id, payload);

        // Log success message
        console.log('ChargeBack updated successfully',  result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack updated successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while updating ChargeBack', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating ChargeBack');
    }
};

const deleteChargeBack = async (req, res) => {
    try {
        const { id } = req.params;  // Assuming the ChargeBack ID is passed as a parameter

        // Call the service to delete the ChargeBack
        const result = await deleteChargeBackService(id);

        // Log success message
        console.log('ChargeBack deleted successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'ChargeBack deleted successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while deleting ChargeBack', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting ChargeBack');
    }
};

export { createChargeBack,getChargeBacksById, getChargeBacks, updateChargeBack, deleteChargeBack };
