import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { getRoleService, createRoleService, updateRoleService,deleteRoleService } from './rolesService.js';
import { VALIDATE_ROLE_SCHEMA, VALIDATE_UPDATE_ROLE_STATUS, VALIDATE_DELETE_ROLE, VALIDATE_ROLE_BY_ID } from '../../schemas/roleSchema.js';
import { transactionWrapper } from '../../utils/db.js';
import { ValidationError } from '../../utils/appErrors.js';

const getRoles = async (req, res) => {
    try {
      const {company_id} = req.user;
      // let search = req.query.search ; 
      const data = await getRoleService({
        company_id,
        // Todo: search
      });
      console.log('get Roles successfully', 'info');
      return sendSuccess(res, data, 'get Roles successfully');
    } catch (error) {
      console.error('error getting while getting Roles', 'error', error);
      return sendError(res, error, 'Error occurred while getting Roles');
    }
};

const getRolesById = async (req, res) => {
    try {
      const { error } = VALIDATE_ROLE_BY_ID.validate(req.params); // Validate ID from params
      if (error) {
        throw new ValidationError(error);
      }
      const { id } = req.params;
      const {company_id} = req.user;
      const data = await getRoleService({id,company_id});
      console.log('get Roles by ID successfully', 'info');
      return sendSuccess(res, data, 'get Roles by ID successfully');
    } catch (error) {
      console.error('error getting while getting Roles by ID', 'error', error);
      return sendError(res, error, 'Error occurred while getting Role by ID');
    }
};

const createRole = async (req, res) => {
    try {
      let payload = req.body;
      if (!payload) {
        console.error('payload is required');
        return sendError(res, 'payload is required', 'Validation Error');
      }
      const {company_id} = req.user;
      payload.company_id=company_id;
      const { error } = VALIDATE_ROLE_SCHEMA.validate(payload); // Validate body
      if (error) {
        throw new ValidationError(error);
      }
      const data = await createRoleService(payload);
      console.log('create Role successfully', 'info');
      return sendSuccess(res, data, 'Create Role successfully');
    } catch (error) {
        console.error('error getting while creating Role', 'error', error);
        return sendError(res, error, 'Error occurred while creating Role');
    }
};

const updateRole = async (req, res) => {
    try {
        const { error: bodyError } = VALIDATE_UPDATE_ROLE_STATUS.validate(req.body); // Validate update body
        if (bodyError) {
          throw new ValidationError(bodyError);
        }
        const { error: paramsError } = VALIDATE_ROLE_BY_ID.validate(req.params); // Validate ID from params
        if (paramsError) {
          throw new ValidationError(paramsError);
        }
        let { body, params } = req;
        const {company_id} = req.user;
        const data = await  transactionWrapper(updateRoleService)(params.id,company_id, body);
        console.log('Update Role successfully', 'info');
        return sendSuccess(res, data, 'Update Role successfully');
    } catch (error) {
        console.error('error getting while updating Role', 'error', error);
        return sendError(res, error, 'Error occurred while updating Role');
    }
};

const deleteRole = async (req, res) => {
    try {
        const { error } = VALIDATE_DELETE_ROLE.validate(req.params); // Validate ID from params
        if (error) {
          throw new ValidationError(error);
        }
        let { params } = req;
        const {company_id} = req.user;
        const userData = { is_obsolete: true };
        const data = await transactionWrapper(deleteRoleService)(params.id,company_id, userData);
        console.log('Delete Role successfully', 'info');
        return sendSuccess(res, data, 'Delete Role successfully');
    } catch (error) {
        console.error('error getting while deleting Role', 'error', error);
        return sendError(res, error, 'Error occurred while deleting Role');
    }
};

export { getRoles, getRolesById, createRole, updateRole, deleteRole };
