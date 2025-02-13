import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createSettlementByIDService, deleteSettlementByIDService, getSettlementByIDService, updateSettlementByIDService } from './settlementServices.js';

const getSettlementById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getSettlementByIDService(id);

    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};

const createSettlement = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createSettlementByIDService(payload);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};

const updateSettlement = async (req, res) => {
  try {
    const payload = req.body;
    const { id } = req.params;
    const data = await updateSettlementByIDService(id, payload);
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};

const deleteSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteSettlementByIDService(id);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}

export { getSettlementById, createSettlement, updateSettlement, deleteSettlement };
