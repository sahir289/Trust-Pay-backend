import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createUserHierarchyService, updateUserHierarchyService, getUserHierarchyService, deleteUserHierarchyService } from './userHierarchyService.js';


const createUserHierarchy = async (req, res) => {
    try {
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
        const { payload } = req.query;

        // Fetch vendors data from the service
        const data = await getUserHierarchyService(payload);

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

const updateUserHierarchy = async (req, res) => {
    try {
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

export { createUserHierarchy, getUserHierarchys, updateUserHierarchy, deleteUserHierarchy };
