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
  const { company_id } = req.user || {};
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
    sortOrder
  );

  if (!settlementData || settlementData.length === 0) {
    return sendSuccess(res, [], 'No settlements found');
  }

  // Send success response
  return sendSuccess(res, settlementData, 'Settlements retrieved successfully');
};
const getSettlementsBySearch = async (req, res) => {
  const { company_id,role} = req.user;
  const { search, page = 1, limit = 10  } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getSettlementsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
  );
  return sendSuccess(res, data, 'settlements fetched successfully');
};
const createSettlementController = async (req, res) => {
  const payload = req.body;
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.status = "INITIATED";
  const joiValidation = CREATE_SETTLEMENT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = {
    method: payload.method,
    amount: payload.amount,
    user_id: payload.user_id,
    company_id,
    created_by: user_id,
    status: "INITIATED",
    config: {
     
       ifsc :  payload.ifsc,
       acc_no:  payload.acc_no,
       acc_holder_name: payload.acc_holder_name,
       bank_name:  payload.bank_name
      
    }
  };
  // const data =
  await createSettlementService(data);
  sendSuccess(res, {}, 'Created settlement');
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
  sendSuccess(res, data, 'Updated settlement');
};

const deleteSettlementController = async (req, res) => {
  const { id } = req.params;
  const { company_id, user_id } = req.user;
  const { role } = req.user;
  const ids = { id, company_id, user_id, role };
  const joiValidation = VALIDATE_SETTLEMENT_BY_ID_DELETE.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  // const updatedData =
  await transactionWrapper(deleteSettlementService)(ids);
  sendSuccess(res, 'Deleted settlement');
};

export {
  updateSettlementController,
  deleteSettlementController,
  createSettlementController,
  getSettlementControllerById,
  getSettlementController,
  getSettlementsBySearch,
};
