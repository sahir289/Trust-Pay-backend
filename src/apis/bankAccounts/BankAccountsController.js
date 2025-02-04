import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { sendError } from '../../utils/responseHandlers.js';
import { createBankService } from './BankAccountsService.js';
import { getBankService ,getBankByIdService, updateBankService,deleteBankService} from './BankAccountsService.js';
const logger = new Logger();

export const createBank = async (req, res) => {
    try {
      const reqBody = req.body;
    //   console.log("Received request body:", reqBody);  
      const data = await createBankService(reqBody);
      logger.log('Bank Created successfully', 'info');
      return sendSuccess(res, data, 'Bank Created successfully');
    } catch (error) {
      console.error("Error in createBank:", error);  
      logger.log('Error while creating bank in controller', 'error', error);
      return sendError(res, 500, 'Failed to create bank');
    }
};



export const getBanks = async (req, res) => {
    try {
        const data = await getBankService();
        logger.log('getBanks successfully', 'info', data);
        return sendSuccess(res, data, 'Banks fetched successfully');
    } catch (error) {
        logger.log('Error while fetching Banks Data', 'error', error);
        return sendError(res, error, 'Error occurred while fetching Banks');
    }
};


export const getBankbyId = async (req, res) => {
    try {
        console.log(req.params);
        const { id } = req.params;

        const data = await getBankByIdService(id);

        console.log("getBankbyid");
        logger.log('Bank fetched successfully', 'info', data);

        return sendSuccess(res, data, 'Bank fetched successfully');
    } catch (error) {
        logger.log('Error occurred while fetching Bank', 'error', error);
        return sendError(res, error, 'Error occurred while fetching Bank');
    }
};

export const updateBank = async (req,res)=>{
 try{
    const payload = req.body;
    const { id } = req.params;
    const data = await updateBankService(payload,id);
    logger.log('update Bank successfully', 'info', data);
    return sendSuccess(res, data, 'Banks fetched successfully');
 }
catch(error){
    logger.log('error getting while updating Banks Data', 'error', error);
    return sendError(res, error, 'Error occurred while fetching Banks');
}
}


export const deleteBank = async (req,res)=>{
    
    try{
        const { id } = req.params;
        const data = await deleteBankService(id);
        logger.log('Delete Bank successfully', 'info', data);
        return sendSuccess(res, data, 'Banks fetched successfully');
    }
    catch(error){
        logger.log('error getting while delete Banks Data', 'error', error);
        return sendError(res, error, 'Error occurred while fetching Banks');
    }
}