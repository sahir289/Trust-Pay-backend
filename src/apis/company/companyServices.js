import {
  createCompanyDao,
  deleteCompanyDao,
  getCompanyDao,
  getCompanyDetailsByIdDao,
  isCompanyEmailExistsDao,
  isCompanyContactNoExistsDao,
  isUserNameExistsDao,
  updateCompanyDao,
} from './companyDao.js';
import { _createUserServiceInternal } from '../users/userService.js';
// import { createDesignationService } from '../designation/designationServices.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { RoleIs, DesignationIs } from '../../constants/index.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { logger } from '../../utils/logger.js';
import config from '../../config/config.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import redisClient from '../../utils/redisClient.js';
import { BadRequestError } from '../../utils/appErrors.js';

const COMPANY_DETAILS_CACHE_TTL_SEC = Number.parseInt(
  process.env.COMPANY_DETAILS_CACHE_TTL_SEC || '60',
  10,
);

const getCompanyService = async (
  filters = {},
  page,
  limit,
  sortBy,
  sortOrder,
) => {
  try {
    const result = await getCompanyDao(
      filters,
      page,
      limit,
      sortBy,
      sortOrder,
    );
    return result;
  } catch (error) {
    logger.error('error getting while company', error);
    throw error;
  }
};

const getCompanyByIdService = async (id) => {
  try {
    const companyId = id?.id || id;
    const cacheKey = `company:details:${companyId}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await getCompanyDetailsByIdDao(id);

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      COMPANY_DETAILS_CACHE_TTL_SEC,
    );

    return result;
  } catch (error) {
    logger.error('error getting while company', error);
    throw error;
  }
};

const _createCompanyServiceInternal = async (payload, companyId = null, conn) => {
  try {
    // Validate payload
    // Create company
    function generateFormatted8DigitCode() {
      let code = Math.floor(10000000 + Math.random() * 90000000).toString();
      return code.match(/.{1,4}/g).join('-');
    }

    const unique_id = generateFormatted8DigitCode();
    const adminCode =
      payload.code || payload.first_name.split('').reverse().join('');

    if (await isCompanyEmailExistsDao(payload.email, companyId, conn)) {
      throw new BadRequestError('Email already exists');
    }
    if (await isCompanyContactNoExistsDao(payload.contact_no, companyId, conn)) {
      throw new BadRequestError('Contact number already exists');
    }
    if (await isUserNameExistsDao(payload.user_name, companyId, conn)) {
      throw new BadRequestError('Username already exists');
    }


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
      two_factor_enforcement: true,
      allowPayAssist: '',
      allowPayDum: false,
      allow_cashfree: false,
      allow_zentechind: false,
      allow_nmplpay: false,
      allow_runsafe: false,
      allowCpsPay: false,
      allow_silkpay: false,
      allow_razorpay: false,
      allowTataPay: false,
      allow_clickrr: false,
      allowRupeeFlow: false,
      allowPayInFintech: false,
      PAY_ASSIST: {
        walletsPayoutsUrl: config.payAssist.baseUrl || '',
        walletsPayoutsAgentCode: '',
        walletsPayoutsAgent: '',
        walletsPayoutsApiKey: '',
        defaultBankId: '',
      },
      PAY_DUM: {
        walletsPayoutsUrl: config.payDum.baseUrl || '',
        walletsPayoutsAgentCode: '',
        walletsPayoutsAgent: '',
        walletsPayoutsApiKey: '',
        defaultBankId: '',
      },
      TATA_PAY: {
        defaultBankId: '',
        walletsPayoutsUrl: config.tataPay.baseUrl || '',
        walletsBulkPayoutsUrl: config.tataPay.bulkUrl || '',
        walletsPayoutsApiKey: '',
      },
      CLICKRR: {
        api_key: '',
        api_secret: '',
        defaultBankId: '',
      },
      RUPEE_FLOW: {
        defaultBankId: '',
        walletsPayoutsUrl: config.rupeeFlow.baseUrl || '',
        clientId: '',
        clientSecret: '',
      },
    };

    const company = await createCompanyDao({
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      contact_no: payload.contact_no,
      config: payload.config || {},
    }, conn);
    let role = [];
    let designations = [];

    role = await getRoleDao({ role: RoleIs.ADMIN }, conn);
    designations = await getDesignationDao({
      designation: DesignationIs.ADMIN,
    }, conn);

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
      code: adminCode,
    };
    // Create user - this will manage its own transaction
    const user = await _createUserServiceInternal(userPayload, conn);

    // Return result
    return {
      company_id: company.id,
      role_ids: role.map((role) => role.id),
      designation_ids: designations.map((designation) => designation.id),
      user_id: user.id,
    };
  } catch (error) {
    logger.error('error in _createCompanyServiceInternal', error);
    throw error;
  }
};

const createCompanyService = async (payload, companyId = null) => {
  let conn
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _createCompanyServiceInternal(payload, companyId, conn);
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      await rollback(conn);
    }
    logger.error('Error while creating company:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const updateCompanyService = async (id, payload) => {
  try {
    const result = updateCompanyDao(id, payload);
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
};
