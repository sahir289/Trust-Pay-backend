import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createChargeBackService, getChargeBacksService, updateChargeBackService, deleteChargeBackService } from './chargeBackService.js';
import { VALIDATE_CHARGEBACK_BY_ID, VALIDATE_CHARGEBACK_SCHEMA, VALIDATE_DELETE_CHARGEBACK, VALIDATE_UPDATE_CHARGEBACK_SCHEMA } from '../../schemas/chargeBackSchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const createChargeBack = async (req, res) => {
    try {

        let payload = req.body;
        if (!payload) {
            console.error('payload is required');
            return sendError(res, 'payload is required', 'Validation Error');
        }
        const {company_id,role} = req.user;
        payload.company_id=company_id;
        // Call the service to create the ChargeBack
        const { error } = VALIDATE_CHARGEBACK_SCHEMA.validate(payload);
        if (error) {
            throw new ValidationError(error);
        }
        const result = await createChargeBackService(payload,role);
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
        const { error } = VALIDATE_CHARGEBACK_BY_ID.validate(req.params);
        if (error) {
            throw new ValidationError(error);
        }
        const { id } = req.params;
        const { company_id, role } = req.user;
        // Call the service to create the ChargeBack
        const result = await getChargeBacksService({ id, company_id }, role);

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
        const { company_id, role } = req.user;
        // const search = req.query.search;
        // Fetch vendors data from the service
        const data = await getChargeBacksService({
            company_id,
            // TODO: search
        }, role);
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
        const { error: paramsError } = VALIDATE_DELETE_CHARGEBACK.validate(req.params);
        if (paramsError) {
            throw new ValidationError(paramsError);
        }
        // Validate body (fields for update)
        const { error: bodyError } = VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate(req.body);
        if (bodyError) {
            return sendError(res, bodyError.details[0].message, 'Validation Error');
        }
        const payload = req.body;
        const { id } = req.params;  
         const {company_id,role} = req.user;
        // Call the service to update the ChargeBack
        const result = await updateChargeBackService({id,company_id}, payload,role);

        // Log success message
        console.log('ChargeBack updated successfully', result);

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
        const { error } = VALIDATE_DELETE_CHARGEBACK.validate(req.params);
        if (error) {
            throw new ValidationError(error);
        }
        const { id } = req.params;  // Assuming the ChargeBack ID is passed as a parameter
        const {company_id,role} = req.user;

        // Call the service to delete the ChargeBack
        const result = await deleteChargeBackService({id,company_id},role);

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

export { createChargeBack, getChargeBacksById, getChargeBacks, updateChargeBack, deleteChargeBack };
