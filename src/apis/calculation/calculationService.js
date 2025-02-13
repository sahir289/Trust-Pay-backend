
import {BadRequestError,} from '../../utils/appErrors.js';
import { getCalculationDao , createCalculationDao , updateCalculationDao ,deleteCalculationDao } from './calculationDao.js';

const getCalculationService = async (payload) => {
    try {
        const data = await getCalculationDao(payload);
        console.log('Fetched Calculations successfully', 'info');
        return data;
    } catch (error) {
       console.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while fetching Calculation');
    }
}

const createCalculationService = async (payload) => {
    try {
        const data = await createCalculationDao(payload);
        console.log('Created Calculation successfully', 'info');
        return data;
    } catch (error) {
       console.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while creating Calculation');
    }
}
const updateCalculationService = async (user_id,payload) => {  
    try {
        const data = await updateCalculationDao(user_id,payload);
        console.log('Updated Calculation successfully', 'info');
        return data;
    } catch (error) {
       console.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while updating Calculation');
    }
}
const deleteCalculationService = async (id) => {  
    try {
        const userData = {is_obsolete: true};
        const data = await deleteCalculationDao(id,userData);
        console.log('Delete Calculation successfully', 'info');
        return data;
    } catch (error) {
       console.error('Error during transaction rollback', 'error', error);
       throw new BadRequestError('Error occurred while Deleting Calculation');
    }
}

export { getCalculationService,createCalculationService,updateCalculationService,deleteCalculationService};