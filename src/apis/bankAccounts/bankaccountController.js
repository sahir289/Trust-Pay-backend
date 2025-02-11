import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountByIDService, createBankaccountByIDService, updateBankaccountByIDService, deleteBankaccountByIDService} from './bankaccountServices.js';



  const getBankaccountById = async (req, res) => {
    try {
       const { id } = req.params;
      const data = await getBankaccountByIDService(id);
      console.log('getUsers successfully');
      return sendSuccess(res, data, 'getUsers successfully');
    } catch (error) {
      console.error('error getting while logging in', error);
    }
  };
  const createBankaccount = async(req, res)=>{
    try {
        const  payload   = req.body;
        if (!payload) {
            console.error('payload is required');
            throw new BadRequestError('payload is required');
          }
       const data = await createBankaccountByIDService(payload);
       console.log('getUsers successfully');
       return sendSuccess(res, data, 'getUsers successfully');
     } catch (error) {
       console.error('error getting while logging in', error);
     }
  }
  
  const updateBankaccount =async(req, res) => {
    try {
        const {id} = req.params;
        const payload = req.body;
       const data = await updateBankaccountByIDService( id,payload);
       console.log('getUsers successfully');
       return sendSuccess(res, data, 'getUsers successfully');
     } catch (error) {
       console.error('error getting while logging in', error);
     }
  }

  
  const deleteBankaccount =async(req, res) => {
    try {
        const { id } = req.params;       
        if (!id) {
            console.error('payload is required');
            throw new BadRequestError('payload is required');
          }
       const data = await deleteBankaccountByIDService( id);
       console.log('getUsers successfully');
       return sendSuccess(res, data, 'getUsers successfully');
     } catch (error) {
       console.error('error getting while logging in', error);
     }
  }
  export {  getBankaccountById, createBankaccount, updateBankaccount, deleteBankaccount };
