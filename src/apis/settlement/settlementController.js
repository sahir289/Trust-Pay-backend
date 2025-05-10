import {
  CREATE_SETTLEMENT_SCHEMA,
  UPDATE_SETTLEMENT_SCHEMA,
  VALIDATE_SETTLEMENT_BY_ID_DELETE,
} from '../../schemas/settlementSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createSettlementService,
  deleteSettlementService,
  getSettlementService,
  getSettlementServiceById,
  getSettlementsBySearchService,
  updateSettlementService,
} from './settlementServices.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getBankResponseDao } from '../bankResponse/bankResponseDao.js';
import logger from '../../utils/logger.js';
const getSettlementControllerById = async (req, res) => {
  const { id } = req.params;
  
  const { company_id } = req.user;
  const { role } = req.user;
  const ids = { id, company_id, role };
  const data = await getSettlementServiceById(ids);
  sendSuccess(res, data, 'got settlement');
};

const getSettlementController = async (req, res) => {
  // Extract user data and query parameters
  const { company_id , user_id , role, designation } = req.user || {};
  const {
    role_name,
    page = 1,
    limit = 10,
    search,
    sortBy,
    sortOrder,
    ...filters
  } = req.query;

  // Prepare filters object
  const filterParams = {
    ...(search && { search }),
    ...(role_name && { role: role_name }),
    ...filters
  };

  // Convert page and limit to numbers
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  // Call service with structured parameters
  const settlementData = await getSettlementService(
    { company_id, role_name },
    filterParams,
    pageNum,
    limitNum,
    sortBy,
    sortOrder,
    role,
    user_id, 
    designation
  );

  if (!settlementData || settlementData.length === 0) {
    return sendSuccess(res, [], 'No settlements found');
  }

  // Send success response
  return sendSuccess(res, settlementData, 'Settlements retrieved successfully');
};
const getSettlementsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation} = req.user;
  const { search, page = 1, limit = 10 ,role_name } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getSettlementsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      role_name,
      ...req.query,
    },
    role,
    designation,
    user_id,
  );
  return sendSuccess(res, data, 'settlements fetched successfully');
};
const createSettlementController = async (req, res) => {
  const payload = req.body;
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.status = "INITIATED";
  payload.user_id = payload.user_id === null ? user_id : payload.user_id;   // no codes sent when vendor login
  const joiValidation = CREATE_SETTLEMENT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  //-- utr and amount for internal tranfer case
  if(payload.amount && payload.utr ){
    const bankRes = await getBankResponseDao({utr: payload.utr})
    if(!bankRes ){
      return res.status(400).json({
        error: {
          status: 404,
          message: 'No entry found.!',
        },
      });
    }
    if(bankRes.amount !== payload.amount){ //--amount mismatch with utr
      return res.status(400).json({
        error: {
          status: 404,
          message: 'Amount is in mismatch!',
        },
      });
    }
  }

  const data = {
    method: payload.method,
    amount: payload.amount,
    user_id: payload.user_id,
    company_id,
    created_by: user_id,
    status: "INITIATED",
    config: {
       wallet_balance : payload.wallet_balance, //--wallet balance also added in config
       description : payload.description,  //--description also added in config
       ifsc :  payload.ifsc,
       acc_no:  payload.acc_no,
       acc_holder_name: payload.acc_holder_name,
       bank_name:  payload.bank_name,
       amount: payload.amount,
       utr: payload.utr      
    }
  };
  // const data =
  const settlement = await createSettlementService(data);
  sendSuccess(res, {}, 'Created Settlement Successfully');
  logger.info("Created Settlement Successfully", settlement);
};

const updateSettlementController = async (req, res) => {
  const { id, user_id } = req.params;
  const { role } = req.user;
  const payload = { ...req.body };
  payload.updated_by = user_id;
  const { company_id } = req.user;
  const ids = { id, company_id, role };
  const joiValidation = UPDATE_SETTLEMENT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await transactionWrapper(updateSettlementService)(ids, payload, role);
  logger.info('Created Settlement Successfully', data);
  sendSuccess(res, {}, 'Updated settlement');
};

const deleteSettlementController = async (req, res) => {
  const { id } = req.params;
  const { company_id, user_id,user_name } = req.user;
  const { role } = req.user;
  const ids = { id, company_id, user_id, role };
  const joiValidation = VALIDATE_SETTLEMENT_BY_ID_DELETE.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  // const updatedData =
  const settlement=await transactionWrapper(deleteSettlementService)(ids);
  sendSuccess(
    res,
    { id: settlement.id, deleted_by: user_name },
    'Deleted settlement Successfully',
  );
};

export {
  updateSettlementController,
  deleteSettlementController,
  createSettlementController,
  getSettlementControllerById,
  getSettlementController,
  getSettlementsBySearch,
};
