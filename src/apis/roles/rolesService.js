import {BadRequestError,} from '../../utils/appErrors.js';
import { getRoleDao,createRoleDao,updateRoleDao,deleteRoleDao } from './rolesDao.js';
import { transactionWrapper } from '../../utils/db.js';

const getRoleService = async (payload) => {
  const data = await getRoleDao(payload);
  return data;
}


const createRoleService = async (payload) => {
  try {
    const roleName = await getRoleDao({ role: payload?.role });
    if (roleName) {
      console.error('Error while updating Role', 'error');
    }

    const data = await createRoleDao(payload);
    console.log('Created Role successfully', 'info');
    return data;
    }  catch (error) {
       console.error('Error while updating Role', 'error', error);
        throw new BadRequestError('Error occurred while Creating Role');
  }
}

const updateRoleService = async (id, body) => {
  if (!body || !id) {
    throw new BadRequestError('Missing required fields: body or id');
  }
  try {
                const data = await transactionWrapper(updateRoleDao)(id,body);
    console.log('Updated Role successfully', 'info');
    return data;
  } catch (error) {
    console.error('Error while updating Role', 'error', error);
    throw new BadRequestError('Error occurred while updating Role');
  }
}

const deleteRoleService = async (id,userData ) => {  
  try {
    const data = await transactionWrapper(deleteRoleDao)(id, userData)
    console.log('Deleted Role successfully', 'info');
    return data;
  } catch (error) {
    console.error('Error while updating Role', 'error', error);
    throw new BadRequestError('Error occurred while updating Role');
  }
}



export { getRoleService,createRoleService ,updateRoleService,deleteRoleService};