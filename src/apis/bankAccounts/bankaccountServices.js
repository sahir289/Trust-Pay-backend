
import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getBankaccountDaoNickName,
} from './bankaccountDao.js';

const getBankaccountService = async ( filters, company_id,role, page, limit) => {
  try {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getBankaccountDao({...filters, company_id}
      ,
      pageNumber, pageSize, role

    );
  } catch (error) {
    console.error('error getting while  getting banks', error);
    throw new BadRequestError('Error getting while  getting banks');
  }
};

const getBankaccountServiceNickName = async (company_id, type) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await getBankaccountDaoNickName(conn, company_id, type,
      null,
      null,
      null,
      null,
      null);
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
}

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
    const result = await updateBankaccountDao(
      { id: ids.id, company_id: ids.company_id },
      payload,
      conn,
    );
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
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getBankaccountServiceNickName
};
