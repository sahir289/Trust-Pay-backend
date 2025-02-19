import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createUserHierarchyService, updateUserHierarchyService, getUserHierarchyService, deleteUserHierarchyService } from './userHierarchyService.js';
import { VALIDATE_UPDATE_USER_HIERARCHY_STATUS,VALIDATE_DELETE_USER_HIERARCHY,VALIDATE_USER_HIERARCHY_SCHEMA,VALIDATE_USER_HIERARCHY_BY_ID } from '../../schemas/userHierarchySchema.js';

const createUserHierarchy = async (req, res) => {
    try {
        const { error } = VALIDATE_USER_HIERARCHY_SCHEMA.validate(req.body);
        if (error) {
            return sendError(res, error.details[0].message, 'Validation Error');
        }
        const payload = req.body;

        // Call the service to create the UserHierarchy
        const result = await createUserHierarchyService(payload);

        // Log success message
        console.log('UserHierarchy created successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'UserHierarchy created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating UserHierarchy', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating UserHierarchy');
    }
};

const getUserHierarchys = async (req, res) => {
    try {
        const payload = req.query.search;

        // Fetch vendors data from the service
        const data = await getUserHierarchyService(payload);

        // Log success message
        console.log('get UserHierarchys successfully', data);

        // Send success response
        return sendSuccess(res, data, 'UserHierarchy fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching UserHierarchy Data',  error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching UserHierarchy');
    }
};

const getUserHierarchysById = async (req, res) => {
    try {
        const { error } = VALIDATE_USER_HIERARCHY_BY_ID.validate(req.params);
        if (error) {
            return sendError(res, error.details[0].message, 'Validation Error');
        }
        const {id} = req.params;

        // Fetch vendors data from the service
        const data = await getUserHierarchyService({id:id});

        // Log success message
        console.log('get UserHierarchy successfully', data);

        // Send success response
        return sendSuccess(res, data, 'UserHierarchy fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching UserHierarchy Data',  error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching UserHierarchy');
    }
};

const updateUserHierarchy = async (req, res) => {
    try {
        const { error: paramsError } =VALIDATE_USER_HIERARCHY_BY_ID.validate(req.params);
        if (paramsError) {
            return sendError(res, paramsError.details[0].message, 'Validation Error');
        }
        // Validate body (fields for update)
        const { error: bodyError } = VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate(req.body);
        if (bodyError) {
            return sendError(res, bodyError.details[0].message, 'Validation Error');
        }
        const payload = req.body;
        const { id } = req.params;  // Assuming the UserHierarchy ID is passed as a parameter

        // Call the service to update the UserHierarchy
        const result = await updateUserHierarchyService(id, payload);

        // Log success message
        console.log('UserHierarchy updated successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'UserHierarchy updated successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while updating UserHierarchy', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating UserHierarchy');
    }
};

const deleteUserHierarchy = async (req, res) => {
    try {
        const { error: paramsError } =VALIDATE_DELETE_USER_HIERARCHY.validate(req.params);
        if (paramsError) {
            return sendError(res, paramsError.details[0].message, 'Validation Error');
        }
        // Validate body (fields for update)
       
        const { id } = req.params;  // Assuming the UserHierarchy ID is passed as a parameter

        // Call the service to delete the UserHierarchy
        const result = await deleteUserHierarchyService(id);

        // Log success message
        console.log('UserHierarchy deleted successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'UserHierarchy deleted successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while deleting UserHierarchy', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting UserHierarchy');
    }
};


export { createUserHierarchy,getUserHierarchysById, getUserHierarchys, updateUserHierarchy, deleteUserHierarchy };
