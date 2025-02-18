import { CREATE_DESIGNATION_SCHEMA, UPDATE_DESIGNATION_SCHEMA } from '../../schemas/designationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao } from './designationDao.js';

const getDesignationService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getDesignationDao(payload);
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createDesignationService = async (payload) => {
  try {
    const joiValidation = CREATE_DESIGNATION_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const result = await createDesignationDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const updateDesignationService = async (id, payload) => {
  try {
    const joiValidation = UPDATE_DESIGNATION_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const result = await updateDesignationDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const deleteDesignationService = async (id) => {
  try {
    const result = await deleteDesignationDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};


export { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService };
