import { BadRequestError } from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCompanyService, deleteCompanyService, getCompanyService, updateCompanyService } from './companyServices.js';
import { sendError } from '../../utils/responseHandlers.js';
import { VALIDATE_COMPANY_SCHEMA,VALIDATE_COMPANY_BY_ID,VALIDATE_UPDATE_COMPANY_STATUS } from '../../schemas/companySchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const getCompany = async (req, res) => {
  try {
    const search = req.query.search;
    const data = await getCompanyService(search);
    return sendSuccess(res, data, 'get Company successfully');
  } catch (error) {
    console.error('error getting while Company', error);
  }
};

const getCompanyById = async (req, res) => {
  try {
    const joiValidation = VALIDATE_COMPANY_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { id } = req.params;
    const data = await getCompanyService({id:id});
    return sendSuccess(res, data, 'get Company successfully');
  } catch (error) {
    console.error('error getting while Company', error);
  }
};

const createCompany = async (req, res) => {
  let conn;
  try {
    // Get the database connection
    conn = await getConnection();
    await beginTransaction(conn); // Start the transaction
    let payload = req.body;
      if (!payload) {
        console.error('payload is required');
        return sendError(res, 'payload is required', 'Validation Error');
      }
      const joiValidation = VALIDATE_COMPANY_SCHEMA.validate(payload);
      if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
      }
    // Pass the connection to the service to perform database operations
    const data = await createCompanyService(payload);
    // Commit the transaction after the operation
    await commit(conn); // Await commit to ensure it is successfully committed
    console.log('Create Company successfully');
    return sendSuccess(res, data, 'Create Company successfully');
  } catch (error) {
    // Rollback the transaction in case of an error
    if (conn) {
      try {
        await rollback(conn); // Await rollback
      } catch (rollbackError) {
        console.log('Error during transaction rollback', 'error', rollbackError);
      }
    }
    console.log('Error while creating company', 'error', error);
    throw new BadRequestError('Error occurred while creating company');
  } finally {
    // Release the connection back to the pool
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.log('Error while releasing the connection', 'error', releaseError);
      }
    }
  }
};

const updateCompany = async (req, res) => {
  try {
    const joiValidation = VALIDATE_UPDATE_COMPANY_STATUS.validate(payload);
        if (joiValidation.error) {
          throw new ValidationError(joiValidation.error);
        }
    const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
      if (Validation.error) {
          throw new ValidationError(Validation.error);
    }
    const payload = req.body;
    const { id } = req.params;
    const data = await updateCompanyService(id, payload);
    return sendSuccess(res, data, 'Update Company successfully');
  } catch (error) {
    console.error('error getting while getting Company', error);
  }
}

const deleteCompany = async (req, res) => {
  try {
    const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
    if (Validation.error) {
        throw new ValidationError(Validation.error);
  }
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteCompanyService(id);
    console.log('Delete Company successfully');
    return sendSuccess(res, data, 'Delete Company successfully');
  } catch (error) {
    console.error('error getting while company', error);
  }
}



export { getCompany,getCompanyById,createCompany, updateCompany, deleteCompany };
