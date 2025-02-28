

import { CREATE_SETTLEMENT_SCHEMA, UPDATE_SETTLEMENT_SCHEMA, VALIDATE_SETTLEMENT_BY_ID, VALIDATE_SETTLEMENT_BY_ID_DELETE } from "../../schemas/settlementSchema.js";
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from "../../utils/db.js";
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createSettlementService, deleteSettlementService, getSettlementService, getSettlementServiceById, updateSettlementService } from "./settlementServices.js";

const getSettlementControllerById = async (req, res) => {
  try {
    const { id } = req.params;
    const joiValidation = VALIDATE_SETTLEMENT_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { company_id } = req.user;
    const {role} = req.user;
    const ids = { id, company_id, role }
    const data = await getSettlementServiceById(ids);
    sendSuccess(res, data, "got settlement");
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const getSettlementController = async (req, res) => {
  try {
    const { company_id } = req.user;
    const settlementData = await getSettlementService({
      company_id,
    });
    if (!settlementData) {
      throw new BadRequestError('Error getting while getting settlements');
    }
    sendSuccess(res, settlementData, "got settlement");
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};


const createSettlementController = async (req, res) => {

  try {
    const payload = req.body;
    const { company_id, user_id } = req.user;
    payload.company_id = company_id;
    payload.created_by = user_id;
    const joiValidation = CREATE_SETTLEMENT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    // const data = 
    await createSettlementService(payload);
    sendSuccess(res, "Created settlement");
  }
  catch (error) {
    console.log('Error while creating Settlement', 'error', error);
    throw new BadRequestError('Error occurred while creating Settlement');
  }
};


const updateSettlementController = async (req, res) => {
    
      try {
        const { id , user_id } = req.params;
        const {role} = req.user;
        const payload = { ...req.body };
        payload.updated_by = user_id;
        const { company_id } = req.user;
        const ids = { id, company_id , role}
        const joiValidation = UPDATE_SETTLEMENT_SCHEMA.validate(payload);
        if (joiValidation.error) {
          throw new ValidationError(joiValidation.error);
        }
        // const updateData = 
        await transactionWrapper(updateSettlementService)(ids, payload);
        sendSuccess(res, "Updated settlement");
      } catch (error) {
        console.log('Error while creating Settlement', 'error', error);
        throw new BadRequestError('Error occurred while creating Settlement');
      }
    };

    const deleteSettlementController = async (req, res) => {
      try {
        const { id } = req.params;
        const { company_id, user_id } = req.user;
        const ids = { id, company_id, user_id }
        const joiValidation = VALIDATE_SETTLEMENT_BY_ID_DELETE.validate(id);
        if (joiValidation.error) {
          throw new ValidationError(joiValidation.error);
        }
        // const updatedData = 
        await transactionWrapper(deleteSettlementService)(ids)
        sendSuccess(res, "Deleted settlement");
      } catch (error) {
        console.error('error getting while deleting settlement', error);
        throw new BadRequestError('Error getting while delete settlement');
      }
    };


    export {  updateSettlementController, deleteSettlementController ,createSettlementController, getSettlementControllerById , getSettlementController};
