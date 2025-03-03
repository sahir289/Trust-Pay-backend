import { BadRequestError } from '../../utils/appErrors.js';
import {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
} from './designationDao.js';

const getDesignationService = async (user) => {
  try {
    const result = await getDesignationDao(user);
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const createDesignationService = async (conn, payload) => {
  try {
    const result = await createDesignationDao(conn, payload);
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const updateDesignationService = async (id, payload) => {
  try {
    const result = await updateDesignationDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const deleteDesignationService = async (id, updated_by) => {
  try {
    const result = await deleteDesignationDao(id, {
      is_obsolete: true,
      updated_by,
    });
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

export {
  getDesignationService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
};
