import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { getRoleService,createRoleService, updateRoleService} from './rolesService.js';


const getRoles = async (req, res) => {
    try {
      const data = await getRoleService();
      console.log('get Roles successfully', 'info');
      return sendSuccess(res, data, 'get Roles successfully');
    } catch (error) {
      console.error('error getting while getting Roles', 'error', error);
    }
  };
 
const createRole = async (req, res) => {
    try {
      const payload = req.body;
      if (!payload) {
        console.error('payload is required');
        throw new sendError('payload is required');
      }
      const data = await createRoleService(payload);
      console.log('create Role successfully', 'info');
      return sendSuccess(res, data, 'Create Role successfully');
    } catch (error) {
        console.error('error getting while creating Role', 'error', error);                                  
    }
  };


  
  const updateRole = async (req, res) => {
    try {
        const { body, params } = req;
        const data = await updateRoleService(params.id, body);
        console.log('Update Role successfully', 'info');
        return sendSuccess(res, data, 'Update Role successfully');
    } catch (error) {
        console.error('error getting while updating Role', 'error', error);                                  
    }
}


const deleteRole = async (req, res) => {
    try {
        const { body, params } = req;
        console.log(body);
        const userData = {is_obsolete: true};
        const data = await updateRoleService(params.id, userData);
        console.log('Delete Role successfully', 'info');
        return sendSuccess(res, data, 'Delete Role successfully');
    } catch (error) {
        console.error('error getting while updating Role', 'error', error);                                  
    }
  };
  
export { getRoles, createRole ,updateRole,deleteRole};