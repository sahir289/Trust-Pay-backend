import { transactionWrapper } from '../../utils/db.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { createPayoutService, deletePayoutService, getPayoutsService, updatePayoutService } from './payOutService.js';

const createPayout = async (req, res) => {
    try {
      let payload = req.body;
      if (!payload) {
        console.error('payload is required');
        return sendError(res, 'payload is required', 'Validation Error');
      }
      const {company_id,role} = req.user;
      payload.company_id=company_id;
        // Call the service to create the Payout
        const result = await createPayoutService( req.headers ,payload,role);
        // Log success message
        console.log('Payout created successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Payout created successfully');
    } catch (error) {
        // Log the error
        console.error('error getting while creating Payout', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while creating Payout');
    }
};


const getPayoutsById = async (req, res) => {
    try {
        const {id} = req.params;
  const {company_id,role}  = req.user;
  const payload={};
        // Fetch vendors data from the service
        const data = await getPayoutsService({id,company_id},payload,role);

        // Log success message
        console.log('getPayouts successfully', data);

        // Send success response
        return sendSuccess(res, data, 'Payouts fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Payouts Data',  error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Payouts');
    }
};


const getPayouts = async (req, res) => {
    try {
        const {company_id,role} = req.user;
        let search = req.query.search;  
        let user={}
        user.company_id=company_id;
        // Fetch vendors data from the service
        const data = await getPayoutsService(search,user,role);

        // Log success message
        console.log('getPayouts successfully', data);

        // Send success response
        return sendSuccess(res, data, 'Payouts fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Payouts Data',  error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Payouts');
    }
};



const updatePayout = async (req, res) => {
    try {
        const payload = req.body;
        const { id } = req.params; 
        const {company_id,role} = req.user;
        const ids = {id,company_id}
         // Assuming the Payout ID is passed as a parameter
        // Call the service to update the Payout
        const result = await transactionWrapper(updatePayoutService)(ids, payload,role);

        // Log success message
        console.log('Payout updated successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Payout updated successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while updating Payout', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while updating Payout');
    }
};

const deletePayout = async (req, res) => {
    try {
        const { id } = req.params;  // Assuming the Payout ID is passed as a parameter
        const {company_id} = req.user;
        // Call the service to delete the Payout
        const result = await deletePayoutService(id,company_id);

        // Log success message
        console.log('Payout deleted successfully', result);

        // Send a success response to the client
        return sendSuccess(res, result, 'Payout deleted successfully');
    } catch (error) {
        // Log the error
        console.error('error occurred while deleting Payout', error);

        // Send an error response to the client
        return sendError(res, error, 'Error occurred while deleting Payout');
    }
};

export { createPayout, getPayouts, updatePayout, deletePayout,getPayoutsById };
