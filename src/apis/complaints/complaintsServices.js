import {BadRequestError,} from '../../utils/appErrors.js';

import { getComplaintsDao , createComplaintsDao, updateComplaintsDao , deleteComplaintsDao } from './complaintsDao.js';
import Logger from '../../utils/logger.js';
const logger = new Logger()

const getComplaintsService = async () => {
    try {
        const data = await getComplaintsDao();
        logger.log('Fetched Complaints successfully', 'info');
        return data;
    } catch (error) {
       logger.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while fetching Complaints');
    }
}


const createComplaintsService = async (payload) => {
    try {
        const data = await createComplaintsDao(payload);
        logger.log('Created Complaints successfully', 'info');
        return data;
    }  catch (error) {
       logger.error('Error while updating Complaints', 'error', error);
        throw new BadRequestError('Error occurred while Creating Complaints');
    }
}


const updateComplaintsService = async (id, body) => {  
            if (!body || !id) {
                throw new BadRequestError('Missing required fields: body or id');
            }
            try {
                const data = await updateComplaintsDao(id, body);
                logger.log('Updated Complaints successfully', 'info');
                return data;
            } catch (error) {
                logger.error('Error while updating Complaints', 'error', error);
                throw new BadRequestError('Error occurred while updating Complaints');
            }
        }


const deleteComplaintsService = async (id,userData ) => {  
    try {
        const data = await deleteComplaintsDao(id,userData);
        logger.log('Deleted Complaints successfully', 'info');
        return data;
    } catch (error) {
            logger.error('Error while updating Complaints', 'error', error);
            throw new BadRequestError('Error occurred while updating Complaints');
        }
}





export {getComplaintsService ,createComplaintsService, updateComplaintsService , deleteComplaintsService}