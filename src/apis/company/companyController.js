import { BadRequestError } from '../../utils/appErrors.js';
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
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createCompanyService(payload);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while getting Company', error);
  }
}

const updateCompany = async (req, res) => {
  try {
    const payload = req.body;
    const { id } = req.params;
    const data = await updateCompanyService(id, payload);
    return sendSuccess(res, data, 'getUsers successfully');
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
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}
export { getCompany, createCompany, updateCompany, deleteCompany };
