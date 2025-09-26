import {
  createCompanyDao,
  deleteCompanyDao,
  getCompanyBySearchDao,
  getCompanyDetailsByIdDao,
  getCompanyNamesDao,
  updateCompanyDao,
} from './companyDao.js';
import { createUserService } from '../users/userService.js';
// import { createDesignationService } from '../designation/designationServices.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { RoleIs, DesignationIs } from '../../constants/index.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { logger } from '../../utils/logger.js';

const getCompanyService = async (filters, searchTerms, page, limit) => {
  try {
    const result = await getCompanyBySearchDao(
      filters,
      searchTerms,
      page,
      limit,
    );
    return result;
  } catch (error) {
    logger.error('error getting while company', error);
    throw error;
  }
};

const getCompanyByIdService = async (id) => {
  try {
    const result = await getCompanyDetailsByIdDao(id);
    return result;
  } catch (error) {
    logger.error('error getting while company', error);
    throw error;
  }
};

const getCompanyNamesService = async () => {
  try {
    const result = await getCompanyNamesDao();
    return result;
  } catch (error) {
    logger.error('error getting while company', error);
    throw error;
  }
};

const createCompanyService = async (conn, payload, user_name, bySuperAdmin) => {
  try {
    // Validate payload
    // Create company
    function generateFormatted8DigitCode() {
      let code = Math.floor(10000000 + Math.random() * 90000000).toString();
      return code.match(/.{1,4}/g).join('-');
    }

    const unique_id = generateFormatted8DigitCode();

    payload.config = {
      ...payload.config,
      unique_admin_id: unique_id,
      telegramBotToken: '',
      telegramAlertsBotToken: '',
      telegramRatioAlertsChatId: '',
      telegramDashboardChatId: '',
      telegramBankAlertChatId: '',
      telegramDuplicateDisputeChatId: '',
      telegramCheckUTRHistoryChatId: '',
      allowPayAssist: '',
      allowcashfree: false,
      PAY_ASSIST: {
        walletsPayoutsUrl: 'https://payassist.co.in/apiPayout',
        walletsPayoutsAgentCode: '',
        walletsPayoutsAgent: '',
        walletsPayoutsApiKey: '',
        defaultBankId: '',
      },
      authorized: bySuperAdmin ? 'true' : 'false',
      created_by: user_name,
      is_enabled: 'false',
      updated_by: user_name,
    };

    const company = await createCompanyDao(conn, {
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      contact_no: payload.contact_no,
      config: payload.config || {},
    });
    let role = [];
    let designations = [];

    role = await getRoleDao({ role: RoleIs.ADMIN });
    designations = await getDesignationDao({
      designation: DesignationIs.ADMIN,
    });

    const userPayload = {
      role_id: role[0].id,
      company_id: company.id,
      designation_id: designations[0].id,
      user_name: payload.user_name,
      email: payload.email,
      contact_no: company.contact_no,
      first_name: payload.first_name,
      last_name: payload.last_name,
      is_enabled: true,
      unique_admin_id: unique_id,
      code: payload.first_name.split('').reverse().join(''),
    };
    // Create user
    const user = await createUserService(conn, userPayload);
    // Return result
    return {
      company_id: company.id,
      role_ids: role.map((role) => role.id),
      designation_ids: designations.map((designation) => designation.id),
      user_id: user.id,
    };
  } catch (error) {
    logger.error('Error while creating company:', error);
    throw error;
  }
};

const updateCompanyService = async (id, payload, user_name) => {
  try {
    const config = {
      ...payload?.config,
      updated_by: user_name,
    };
    delete payload?.config;
    const result = updateCompanyDao(id, { ...payload, config });
    return result;
  } catch (error) {
    logger.error('Error while creating company:', error);
    throw error;
  }
};
const deleteCompanyService = async (id) => {
  try {
    const result = deleteCompanyDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    logger.error('Error while creating company:', error);
    throw error;
  }
};

export {
  getCompanyService,
  getCompanyByIdService,
  createCompanyService,
  updateCompanyService,
  deleteCompanyService,
  getCompanyNamesService,
};
