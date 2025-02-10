import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getRoleService,createRoleService,updateRoleService,deleteRoleService } from './rolesService.js';

const logger = new Logger();





const getRoles = async (req, res) => {
    console.log('getRoles');
    try {
      const payload = req.body;
      const data = await getRoleService(payload);
      logger.log('getRoles successfully', 'info');
      return sendSuccess(res, data, 'getRoles successfully');
    } catch (error) {
      logger.log('error getting while getting Roles', 'error', error);
    }
  };


const createRole = async (req, res) => {
    console.log('createRole');
    try {
      const payload = req.body;
      const data = await createRoleService(payload);
      logger.log('createRole successfully', 'info');
      return sendSuccess(res, data, 'createRole successfully');
    } catch (error) {
        logger.log('error getting while creating Role', 'error', error);                                  
    }
  };


  
const updateRole = async (req, res) => {
    try{
            const payload = req.body;   
            const data = await updateRoleService(payload);
            logger.log('updateRole successfully', 'info');
            return sendSuccess(res, data, 'updateRole successfully');
    }
    catch(error){
        logger.log('error getting while updating Role', 'error', error);                                  
    }
}


const deleteRole = async (req, res) => {
    try{
            const payload = req.body;   
            const data = await deleteRoleService(payload);
            logger.log('deleteRole successfully', 'info');
            return sendSuccess(res, data, 'deleteRole successfully');
    }
    catch(error){
        logger.log('error getting while deleting Role', 'error', error);                                  
      }
  };
  
export { getRoles, createRole, updateRole, deleteRole };