import {BadRequestError,} from '../../utils/appErrors.js';
import { getComplaintsDao , createComplaintsDao, updateComplaintsDao , deleteComplaintsDao } from './complaintsDao.js';

const getComplaintsService = async (payload) => {
        const data = await getComplaintsDao(payload);
   return data;
}


const createComplaintsService = async (payload) => {
        const data = await createComplaintsDao(payload);
        return data;
    
}


const updateComplaintsService = async (id, body) => {  
            if (!body || !id) {
                throw new BadRequestError('Missing required fields: body or id');
            }
                const data = await updateComplaintsDao(id, body);
                return data;
        }


const deleteComplaintsService = async (id,userData ) => {  
        const data = await deleteComplaintsDao(id,userData);
        return data;
}




export {getComplaintsService ,createComplaintsService, updateComplaintsService , deleteComplaintsService}