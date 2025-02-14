
import {BadRequestError,} from '../../utils/appErrors.js';
import { getCalculationDao , createCalculationDao , updateCalculationDao ,deleteCalculationDao } from './calculationDao.js';
import { Logger } from 'winston';
const logger = new Logger();
const getCalculationService = async (payload) => {
    try {
        const data = await getCalculationDao(payload);
        logger.log('Fetched Calculations successfully', 'info');
        return data;
    } catch (error) {
       logger.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while fetching Calculation');
    }
}

const createCalculationService = async (payload) => {
    try {
        const data = await createCalculationDao(payload);
        logger.log('Created Calculation successfully', 'info');
        return data;
    } catch (error) {
       logger.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while creating Calculation');
    }
}
const updateCalculationService = async (user_id,payload) => {  
    try {
        const data = await updateCalculationDao(user_id,payload);
        logger.log('Updated Calculation successfully', 'info');
        return data;
    } catch (error) {
       logger.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while updating Calculation');
    }
}
const deleteCalculationService = async (id) => {  
    try {
        const userData = {is_obsolete: true};
        const data = await deleteCalculationDao(id,userData);
        logger.log('Delete Calculation successfully', 'info');
        return data;
    } catch (error) {
       logger.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while Deleting Calculation');
    }
}

export { getCalculationService,createCalculationService,updateCalculationService,deleteCalculationService};