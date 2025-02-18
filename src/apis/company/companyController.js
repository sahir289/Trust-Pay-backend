import { BadRequestError } from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCompanyService, deleteCompanyService, getCompanyService, updateCompanyService } from './companyServices.js';


const getCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getCompanyService(id);

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
    
    const payload = req.body;
    
    // Validate the payload
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
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
export { getCompany, createCompany, updateCompany, deleteCompany };
