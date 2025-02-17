import { BadRequestError, CustomError } from '../../utils/appErrors.js';
import { createSettlementDao, deleteSettlementDao, getSettlementDao, updateSettlementDao } from './settlementDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
const getSettlementService = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const merchantData = await getMerchantsDao({ searchString: id });
    if (merchantData.length > 0) {

      const merchantUserData = await getSettlementDao(merchantData?.user_id);
      return sendSuccess(res, merchantUserData, 'get settlements successfully');
    } else {
      const vendorData = await getVendorsDao({ searchString: id });
      const vendorUserData = await getSettlementDao(vendorData?.user_id);
      return sendSuccess(res, vendorUserData, 'get settlements successfully');
    }
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const createSettlementService = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(payload.id);
    if (merchantData.length > 0) {
      
      const merchantUserData = await getSettlementService(merchantData?.user_id);
      if (merchantUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }

    const vendorData = await getVendorsDao(payload.id);
    if (vendorData.length > 0) {
      const vendorUserData = await getSettlementService(vendorData?.user_id);
      if (vendorUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }

    const data = await createSettlementDao(payload);
    return sendSuccess(res, data, 'create settlements successfully');

  } catch (error) {
    console.error('error getting while creating', error);
    throw new BadRequestError('Error getting while creating settlement');
  }
};


const updateSettlementService = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { id } = req.params;
    const data = await getSettlementDao(id)
    const calculationData = await getCalculationDao(data.user_id);
    let count = calculationData?.total_settlement_count + 1;
    
    let amountCalculation = calculationData?.total_settlement_amount + payload?.amount;
    let calculationId = calculationData?.id;
    if (req.body.config.refrence_id) {
      payload.status = "SUCCESS";
      const updatedCalculation = await updateCalculationDao(  calculationId , { total_settlement_count: count, total_settlement_amount: amountCalculation })
      console.log(updatedCalculation, calculationId, count,amountCalculation, "data")
    }
    if (req.body.status == "INITIATED") {
      payload.config.refrence_id = "";
      payload.config.rejected_reason = "";
    }
    if (req.body.config.rejected_reason) {
      payload.status = "REVERSED";
    }
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const updateData = await updateSettlementDao(id, payload);
    return sendSuccess(res, updateData, 'update settlements successfully');

  } catch (error) {
    console.error('error getting while ', error);
    throw new BadRequestError('Error getting while creating settlements');
  }
};

const deleteSettlementService = async (req, res) => {
  try {

    const { id } = req.params;
    const payload = { is_obsolete: true };
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(id);
    if (merchantData.length > 0) {
      const settlementData = await getSettlementService(merchantData?.user_id);
      const merchantUserData = await deleteSettlementDao(settlementData?.id, payload);
      return sendSuccess(res, merchantUserData, 'delete settlements successfully');
    } else {

      const vendorData = await getVendorsDao({ searchString: id });
      const settlementData = await getSettlementService(vendorData?.user_id);
      const vendorUserData = await deleteSettlementDao(settlementData?.id, payload);
      return sendSuccess(res, vendorUserData, 'delete settlements successfully');

    }

  } catch (error) {
    console.error('error getting while deleting settlement', error);
    throw new BadRequestError('Error getting while delete settlement');
  }
};

export { getSettlementService, createSettlementService, updateSettlementService, deleteSettlementService };
