import {  sendSuccess } from '../../utils/responseHandlers.js';
import { getComplaintsService,createComplaintsService,updateComplaintsService,deleteComplaintsService } from './complaintsServices.js';
import Logger from '../../utils/logger.js';
const logger = new Logger()

const getComplaints = async (req, res) => {
    try {
      const data = await getComplaintsService();
      logger.log('get complaints successfully', 'info');
      return sendSuccess(res, data, 'get complaints successfully');
    } catch (error) {
      Logger.error('error getting while getting complaints', 'error', error);
    }
  };

const createComplaints = async (req, res) => {
    try {
      const payload = req.body;
      if (!payload) {
        logger.error('payload is required');
      }
      const data = await createComplaintsService(payload);
      logger.log('create Complaints successfully', 'info');
      return sendSuccess(res, data, 'Create Complaints successfully');
    } catch (error) {
        logger.error('error getting while creating Complaints', 'error', error);                                  
    }
  };

  
  const updateComplaints = async (req, res) => {
    try {
        const { body, params } = req;
        const data = await updateComplaintsService(params.id, body);
        logger.log('Update Complaints successfully', 'info');
        return sendSuccess(res, data, 'Update Complaints successfully');
    } catch (error) {
        logger.error('error getting while updating Complaints', 'error', error);                                  
    }
}


const deleteComplaints = async (req, res) => {
    try {
        const {  params } = req;
        const userData = {is_obsolete: true};
        const data = await deleteComplaintsService(params.id, userData);
        logger.log('Delete Complaints successfully', 'info');
        return sendSuccess(res, data, 'Delete Complaints successfully');
    } catch (error) {
        logger.error('error getting while updating Complaints', 'error', error);                                  
    }
  };

export  {getComplaints , createComplaints, updateComplaints, deleteComplaints}
 