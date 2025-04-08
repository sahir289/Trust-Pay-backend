import {
  CREATE_SETTLEMENT_SCHEMA,
  UPDATE_SETTLEMENT_SCHEMA,
  VALIDATE_SETTLEMENT_BY_ID_DELETE,
} from '../../schemas/settlementSchema.js';
import {  InternalServerError, ValidationError } from '../../utils/appErrors.js';
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
  const { company_id } = req.user;
  const { role_name, page, limit, search } = req.query;
  const ids= {company_id , role_name}
  const settlementData = await getSettlementService(ids,  page, limit, search);
  if (!settlementData) {
    throw new InternalServerError('Error getting while getting settlements');
  }
  sendSuccess(res, settlementData, 'got settlement');
};
const getSettlementsBySearch = async (req, res) => {
  const { company_id} = req.user;
  const { search, page = 1, limit = 10 ,role_name } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getSettlementsBySearchService(
    {
      company_id,
      role_name,
      search,
      page,
      limit,
      ...req.query,
    },
    // role,
  );
  console.log('get settlements successfully');
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
  // const data =
  await createSettlementService(payload);
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
  sendSuccess(res,data, 'Updated settlement');
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
