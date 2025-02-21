import {  sendSuccess } from '../../utils/responseHandlers.js';
import { getComplaintsService,createComplaintsService,updateComplaintsService,deleteComplaintsService } from './complaintsServices.js';
import { VALIDATE_COMPLAINT_BY_ID,VALIDATE_COMPLAINT_SCHEMA,VALIDATE_UPDATE_COMPLAINT_STATUS,VALIDATE_DELETE_COMPLAINT} from '../../schemas/complaintSchema.js';
import { sendError } from '../../utils/responseHandlers.js';

const getComplaints = async (req, res) => {
    try {
      const {company_id} = req.user;
      let payload = req.query.search;
      payload.company_id=company_id;
      const data = await getComplaintsService(payload);
      console.log ('get complaints successfully');
      return sendSuccess(res, data, 'get complaints successfully');
    } catch (error) {
      console.error('error getting while getting complaints', 'error', error);
    }
};

const getComplaintsById =  async (req, res) => {
    try {
      const { error } = VALIDATE_COMPLAINT_BY_ID.validate(req.params);
      if (error) {
          return sendError(res, error.details[0].message, 'Validation Error');
      }
      const {id} = req.params;
      const data = await getComplaintsService({id:id});
      console.log ('get complaint successfully');
      return sendSuccess(res, data, 'get complaint successfully');
    } catch (error) {
      console.error('error getting while getting complaint', 'error', error);
    }
};



const createComplaints = async (req, res) => {
    try {
      const { error } = VALIDATE_COMPLAINT_SCHEMA.validate(req.body);
      if (error) {
          return sendError(res, error.details[0].message, 'Validation Error');
      }
      let payload = req.body;
      if (!payload) {
        console.error('payload is required');
        return sendError(res, 'payload is required', 'Validation Error');
      }
      const {company_id} = req.user;
      payload.company_id=company_id;
      const data = await createComplaintsService(payload);
      console.log('create Complaints successfully', 'info');
      return sendSuccess(res, data, 'Create Complaints successfully');
    } catch (error) {
        console.error('error getting while creating Complaints', 'error', error);                                  
    }
};


const updateComplaints = async (req, res) => {
    try {
      const { error: paramsError } =VALIDATE_COMPLAINT_BY_ID.validate(req.params);
      if (paramsError) {
          return sendError(res, paramsError.details[0].message, 'Validation Error');
      }
      // Validate body (fields for update)
      const { error: bodyError } = VALIDATE_UPDATE_COMPLAINT_STATUS.validate(req.body);
      if (bodyError) {
          return sendError(res, bodyError.details[0].message, 'Validation Error');
      }
        const { body, params } = req;
        const data = await updateComplaintsService(params.id, body);
        console.log('Update Complaints successfully', 'info');
        return sendSuccess(res, data, 'Update Complaints successfully');
    } catch (error) {
        console.error('error getting while updating Complaints', 'error', error);                                  
    }
}


const deleteComplaints = async (req, res) => {
    try {
      const { error } = VALIDATE_DELETE_COMPLAINT.validate(req.params);
      if (error) {
          return sendError(res, error.details[0].message, 'Validation Error');
      }
        const {  params } = req;
        const userData = {is_obsolete: true};
        const data = await deleteComplaintsService(params.id, userData);
        return sendSuccess(res, data, 'Delete Complaints successfully');
    } catch (error) {
        console.error('error getting while updating Complaints', 'error', error);                                  
    }
};




export  {getComplaints , createComplaints,getComplaintsById, updateComplaints, deleteComplaints}
 