import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCompanyByIDService, deleteCompanyByIDService, getCompanyByIDService, updateCompanyByIDService } from './companyServices.js';



const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getCompanyByIDService(id);

    return sendSuccess(res, data, 'get Company successfully');
  } catch (error) {
    console.error('error getting while Company', error);
  }
};
const createCompany = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createCompanyByIDService(payload);
    console.log('Create Company successfully');
    return sendSuccess(res, data, 'Create Company successfully');
  } catch (error) {
    console.error('error getting while getting Company', error);
  }
}

const updateCompany = async (req, res) => {
  try {
    const payload = req.body;
    const { id } = req.params;
    const data = await updateCompanyByIDService(id, payload);
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
    const data = await deleteCompanyByIDService(id);
    console.log('Delete Company successfully');
    return sendSuccess(res, data, 'Delete Company successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}
export { getCompanyById, createCompany, updateCompany, deleteCompany };
