import {BadRequestError,} from '../../utils/appErrors.js';

import { getComplaintsDao , createComplaintsDao, updateComplaintsDao , deleteComplaintsDao } from './complaintsDao.js';

const getComplaintsService = async (payload) => {
        const data = await getComplaintsDao(payload);
   return data;
}


const createComplaintsService = async (payload) => {
    try {
        const data = await createComplaintsDao(payload);
console.info('Created Complaints successfully', 'info');
        return data;
    }  catch (error) {
console.error('Error while updating Complaints', 'error', error);
        throw new BadRequestError('Error occurred while Creating Complaints');
    }
}


const updateComplaintsService = async (id, body) => {  
            if (!body || !id) {
                throw new BadRequestError('Missing required fields: body or id');
            }
            try {
                const data = await updateComplaintsDao(id, body);
console.info('Updated Complaints successfully', 'info');
                return data;
            } catch (error) {
console.error('Error while updating Complaints', 'error', error);
                throw new BadRequestError('Error occurred while updating Complaints');
            }
        }


const deleteComplaintsService = async (id,userData ) => {  
    try {
        const data = await deleteComplaintsDao(id,userData);
        console.log('Deleted Complaints successfully', 'info');
        return data;
    } catch (error) {
console.error('Error while updating Complaints', 'error', error);
            throw new BadRequestError('Error occurred while updating Complaints');
        }
}




export {getComplaintsService ,createComplaintsService, updateComplaintsService , deleteComplaintsService}