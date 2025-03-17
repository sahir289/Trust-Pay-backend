import {
  CREATE_SETTLEMENT_SCHEMA,
  UPDATE_SETTLEMENT_SCHEMA,
  VALIDATE_SETTLEMENT_BY_ID,
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
  updateSettlementService,
} from './settlementServices.js';

const getSettlementControllerById = async (req, res) => {
  const { id } = req.params;
  const joiValidation = VALIDATE_SETTLEMENT_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id } = req.user;
  const { role } = req.user;
  const ids = { id, company_id, role };
  const data = await getSettlementServiceById(ids);
  sendSuccess(res, data, 'got settlement');
};

const getSettlementController = async (req, res) => {
  const { company_id } = req.user;
  const { role_name, page, limit } = req.query;
  const ids= {company_id , role_name}
  const settlementData = await getSettlementService(ids,  page, limit);
  if (!settlementData) {
    throw new InternalServerError('Error getting while getting settlements');
  }
  sendSuccess(res, settlementData, 'got settlement');
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
  const data = await transactionWrapper(updateSettlementService)(ids, payload);
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
};
