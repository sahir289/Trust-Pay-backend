import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getDesignationByIDService, createDesignationByIDService, updateDesignationByIDService, deleteDesignationByIDService} from './designationServices.js';



  const getDesignationById = async (req, res) => {
    try {
       const { id } = req.params;
      const data = await getDesignationByIDService(id);
      console.log('getUsers successfully');
      return sendSuccess(res, data, 'getUsers successfully');
    } catch (error) {
      console.error('error getting while logging in', error);
    }
  };
  const createDesignation = async(req, res)=>{
    try {
        const  payload   = req.body;
        if (!payload) {
            console.error('payload is required');
            throw new BadRequestError('payload is required');
          }
       const data = await createDesignationByIDService(payload);
       console.log('getUsers successfully');
       return sendSuccess(res, data, 'getUsers successfully');
     } catch (error) {
       console.error('error getting while logging in', error);
     }
  }
  
  const updateDesignation =async(req, res) => {
    try {
        const payload = req.body;
        const {id} = req.params;
       const data = await updateDesignationByIDService(id, payload);
       return sendSuccess(res, data, 'getUsers successfully');
     } catch (error) {
       console.error('error getting while logging in', error);
     }
  }

  
  const deleteDesignation =async(req, res) => {
    try {
        const { id } = req.params;       
        if (!id) {
            console.error('payload is required');
            throw new BadRequestError('payload is required');
          }
       const data = await deleteDesignationByIDService( id);
       console.log('getUsers successfully');
       return sendSuccess(res, data, 'getUsers successfully');
     } catch (error) {
       console.error('error getting while logging in', error);
     }
  }
  export {  getDesignationById, createDesignation, updateDesignation, deleteDesignation };
