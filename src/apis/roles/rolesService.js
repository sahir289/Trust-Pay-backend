import {BadRequestError,} from '../../utils/appErrors.js';
import { getRoleDao,createRoleDao,updateRoleDao,deleteRoleDao } from './rolesDao.js';

const getRoleService = async (filters) => {
    try {
        const data = await getRoleDao(filters);
        return data;
    } catch (error) {
        console.error('Error while fetching role', error);
        throw new BadRequestError('Error occurred while fetching role');
    }
};



const createRoleService = async (payload) => {
    try {
        const data = await createRoleDao(payload);
        console.log('Created Role successfully', 'info');
        return data;
    }  catch (error) {
       console.error('Error while updating Role', 'error', error);
        throw new BadRequestError('Error occurred while Creating Role');
  }
}

const updateRoleService = async (conn,id,company_id, body) => {  
            if (!body || !id) {
                throw new BadRequestError('Missing required fields: body or id');
            }
            try {
                const data = await updateRoleDao(conn,id,company_id,body);
                console.log('Updated Role successfully', 'info');
                return data;
            } catch (error) {
                console.error('Error while updating Role', 'error', error);
                throw new BadRequestError('Error occurred while updating Role');
            }
        }

const deleteRoleService = async (conn,id,company_id,userData ) => {  
    try {
        const data = await deleteRoleDao(conn,id,company_id,userData);
        console.log('Deleted Role successfully', 'info');
        return data;
    } catch (error) {
            console.error('Error while updating Role', 'error', error);
            throw new BadRequestError('Error occurred while updating Role');
        }
}



export { getRoleService,createRoleService ,updateRoleService,deleteRoleService};