import {BadRequestError,} from '../../utils/appErrors.js';
import { getRoleDao,createRoleDao,updateRoleDao,deleteRoleDao } from './rolesDao.js';


const getRoleService = async (payload) => {
    try {
        const data = await getRoleDao(payload);
        console.log('Fetched Roles successfully', 'info');
        return data;
    } catch (error) {
       console.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while fetching Roles');
    }
}


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

const updateRoleService = async (id, body) => {  
            if (!body || !id) {
                throw new BadRequestError('Missing required fields: body or id');
            }
            try {
                const data = await updateRoleDao(id, body);
                console.log('Updated Role successfully', 'info');
                return data;
            } catch (error) {
                console.error('Error while updating Role', 'error', error);
                throw new BadRequestError('Error occurred while updating Role');
            }
        }

const deleteRoleService = async (id,userData ) => {  
    try {
        const data = await deleteRoleDao(id,userData);
        console.log('Deleted Role successfully', 'info');
        return data;
    } catch (error) {
            console.error('Error while updating Role', 'error', error);
            throw new BadRequestError('Error occurred while updating Role');
        }
}



export { getRoleService,createRoleService ,updateRoleService,deleteRoleService};