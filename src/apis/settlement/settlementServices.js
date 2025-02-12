import { BadRequestError } from '../../utils/appErrors.js';
import { createSettlementByIdDao, deleteSettlementByIdDao, getSettlementByIdDao, updateSettlementByIdDao } from './settlementDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

const getSettlementByIDService = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const merchantData = await getMerchantsDao({ searchString: id });
    if (merchantData.length > 0) {

      const merchantUserData = await getSettlementByIdDao(merchantData?.user_id);
      return sendSuccess(res, merchantUserData, 'getUsers successfully');
  } else {
    const vendorData = await getVendorsDao({ searchString: id });
    const vendorUserData = await getSettlementByIdDao(vendorData?.user_id);
    return sendSuccess(res, vendorUserData, 'getUsers successfully');

  }}catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createSettlementByIDService = async (req, res ) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(payload.id);
    if (merchantData.length > 0) {

      const merchantUserData = await getSettlementByIDService(merchantData?.user_id);
      if (merchantUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }

    const vendorData = await getVendorsDao(payload.id);
    if (vendorData.length > 0) {
      const vendorUserData = await getSettlementByIDService(vendorData?.user_id);
      if (vendorUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }

    const data = await createSettlementByIdDao(payload);
    return sendSuccess(res, data, 'getUsers successfully');

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};


const updateSettlementByIDService = async (req, res) => {
  try {
    const payload = {...req.body};
    const { id } = req.params;
    if (req.body.config.refrence_id) {
      payload.status = "SUCCESS";
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
      const updateData = await updateSettlementByIdDao(id, payload);
      return sendSuccess(res, updateData, 'getUsers successfully');
    
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const deleteSettlementByIDService = async (req, res) => {
  try {
 
    const { id } = req.params;
    const payload = { is_obsolete: true };
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(id);
    if (merchantData.length > 0) {
      const settlementData = await getSettlementByIDService(merchantData?.user_id);
      const merchantUserData = await deleteSettlementByIdDao(settlementData?.id, payload);
      return sendSuccess(res, merchantUserData, 'getUsers successfully');
    } else {

      const vendorData = await getVendorsDao({ searchString: id });
      const settlementData = await getSettlementByIDService(vendorData?.user_id);
      const vendorUserData = await deleteSettlementByIdDao(settlementData?.id, payload);
      return sendSuccess(res, vendorUserData, 'getUsers successfully');

    }  

    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

export { getSettlementByIDService, createSettlementByIDService, updateSettlementByIDService, deleteSettlementByIDService };
