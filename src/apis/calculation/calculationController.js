import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCalculationService ,createCalculationService ,updateCalculationService ,deleteCalculationService} from './calculationService.js';
import { Logger } from 'winston';
const logger = new Logger();
const getCalculation = async (req, res) => {
    try {
      const payload = req.body;
      const data = await getCalculationService(payload);
      logger.info('Get Calculations successfully', 'info');
      return sendSuccess(res, data, 'get Calculations successfully');
    } catch (error) {
      logger.error('error getting while getting Calculation', 'error', error);
    }
  };

const createCalculation = async (req, res) => {
    try {
      const body = req.body;
      const data = await createCalculationService(body);
      logger.info('Create Calaculation successfully', 'info');
      return sendSuccess(res, data, 'Create Calculation successfully');
    } catch (error) {
      logger.error('error creating while creating Calculation', 'error', error);
    }
  }

const updateCalculation = async (req, res) => { 
    try {
      const {body,params} = req;
      const data = await updateCalculationService(params.user_id,body);
      logger.info('Update Calculation successfully', 'info');
      return sendSuccess(res, data, 'Update Calculation successfully');
    } catch (error) {
      logger.error('error updating while updating Calculation', 'error', error);
    }
}
const deleteCalculation = async (req, res) => {
    try {
      const params = req.params;
      const data = await deleteCalculationService(params.id);
      logger.info('Delete Calculation successfully', 'info');
      return sendSuccess(res, data, 'Delete Calculation successfully');
    } catch (error) {
      logger.error('error deleting while deleting Calculation', 'error', error);
    }
  }

export { getCalculation,createCalculation,updateCalculation,deleteCalculation };