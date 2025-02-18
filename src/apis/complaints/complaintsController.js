import {  sendSuccess } from '../../utils/responseHandlers.js';
import { getComplaintsService,createComplaintsService,updateComplaintsService,deleteComplaintsService } from './complaintsServices.js';




const getComplaints = async (req, res) => {
    try {
      const payload = req.query.search;
      const data = await getComplaintsService(payload);
      console.log ('get complaints successfully');
      return sendSuccess(res, data, 'get complaints successfully');
    } catch (error) {
      console.error('error getting while getting complaints', 'error', error);
    }
};

const getComplaintsById =  async (req, res) => {
    try {
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
      const payload = req.body;
      
      const data = await createComplaintsService(payload);
      console.log('create Complaints successfully', 'info');
      return sendSuccess(res, data, 'Create Complaints successfully');
    } catch (error) {
        console.error('error getting while creating Complaints', 'error', error);                                  
    }
};


const updateComplaints = async (req, res) => {
    try {
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
        const {  params } = req;
        const userData = {is_obsolete: true};
        const data = await deleteComplaintsService(params.id, userData);
        return sendSuccess(res, data, 'Delete Complaints successfully');
    } catch (error) {
        console.error('error getting while updating Complaints', 'error', error);                                  
    }
};




export  {getComplaints , createComplaints,getComplaintsById, updateComplaints, deleteComplaints}
 