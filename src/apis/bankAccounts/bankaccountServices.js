import { Role } from '../../constants/index.js';
import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { deactivateBank } from '../../utils/sockets.js';
import {
  getBankResponseDaoAll,
  updateBotResponseDao,
} from '../bankResponse/bankResponseDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getBankaccountDaoNickName,
  getBankAccountsBySearchDao,
} from './bankaccountDao.js';

const getBankaccountService = async (
  filters,
  company_id,
  role,
  page,
  limit,
  user_id,
  designation
) => {
  try {

    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID ) {
        filters.user_id = [parentID];      
      }
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getBankaccountDao(
      { company_id, ...filters },
      pageNumber,
      pageSize,
      role,
    );
  } catch (error) {
    logger.error('error getting while  getting banks', error);
    throw new InternalServerError(error);
  }
};

const getBankAccountBySearchService = async (
  company_id,
  role,
  search,
  bank_used_for,
  page,
  limit,
) => {
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = search.split(',')
      .map(term => term.trim())
      .filter(term => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search items');
    }
    const offset = (pageNum - 1) * limitNum;
    return await getBankAccountsBySearchDao(company_id, role, searchTerms, limitNum, offset, bank_used_for);
  } catch (error) {
    logger.error('error getting while getting check utr by search', error);
    throw new InternalServerError(error.message);
  }
};

const getBankaccountServiceNickName = async (company_id, type) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await getBankaccountDaoNickName(
      conn,
      company_id,
      type,
      null,
      null,
      null,
      null,
      null,
    );
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        console.error('Error during transaction rollback', rollbackError);
      }
    }
    console.error('Error while deleting ChargeBack', error);
    throw new InternalServerError(error);
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

const createBankaccountService = async (payload) => {
  try {
    const result = await createBankaccountDao(payload);
    return result;
  } catch (error) {
    console.error('error getting while  creating banks', error);
    throw new BadRequestError('Error getting while  creating banks');
  }
};

const updateBankaccountService = async (conn, ids, payload) => {
  try {
    let result;

    if (Object.keys(payload).length === 0) {
      const bank = await getBankaccountDao({
        id: ids.id,
        company_id: ids.company_id,
      });

      if (bank[0].today_balance >= bank[0].config?.max_limit) {
        payload.is_enabled = false;
        deactivateBank(bank[0].nick_name, ids.id);
      } else if (bank[0].today_balance === bank[0].config?.max_limit) {
        deactivateBank(bank[0].nick_name, ids.id, true);
      }
    }

    const payloadData = JSON.parse(JSON.stringify(payload));
    if (Object.keys(payload).length > 0) {
      result = await updateBankaccountDao(
        { id: ids.id, company_id: ids.company_id },
        payload,
        conn,
      );
    }
    if (payloadData?.config?.is_freeze === true) {
      const bankResponse = await getBankResponseDaoAll({
        bank_id: ids.id,
        is_used: false,
      },null,null,null,null);
      if (bankResponse.rows.length > 0) {
        for (let i = 0; i < bankResponse.rows.length; i++) {          
          await updateBotResponseDao(bankResponse.rows[i].id, {
            status: '/freezed',
          });        
        }
      }
    }
    return result;
  } catch (error) {
    console.error('error getting while  updating banks', error);
    throw new BadRequestError('Error getting while  updating banks');
  }
};

const deleteBankaccountService = async (conn, ids) => {
  try {
    const payload = { is_obsolete: true };
    const result = await deleteBankaccountDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    return result;
  } catch (error) {
    console.error('error getting while deleting banks', error);
    throw new BadRequestError('Error getting while  deleting banks');
  }
};

export {
  getBankaccountService,
  getBankAccountBySearchService,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getBankaccountServiceNickName,
};
