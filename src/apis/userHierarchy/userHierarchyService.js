import { InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createUserHierarchyDao,
  deleteUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from './userHierarchyDao.js';
import { columns, merchantColumns, Role } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
const createUserHierarchyService = async (payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await createUserHierarchyDao(payload);
    await commit(conn); // Commit the transaction
    console.log('UserHierarchy created successfully', 'info');
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while creating UserHierarchy', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const getUserHierarchyService = async (filters, role,  page, limit) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
        const pageNumber = parseInt(page, 10) || 1;
        const pageSize = parseInt(limit, 10) || 10;
    return await getUserHierarchysDao(
      filters, pageNumber, pageSize, 
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    console.error('Error while fetching UserHierarchys', error);
    throw new InternalServerError(error);
  }
};

const updateUserHierarchyService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateUserHierarchyDao(id, payload); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    console.log('UserHierarchy updated successfully', 'info');
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while updating UserHierarchy', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const deleteUserHierarchyService = async (ids, updated_by, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true, updated_by };
    const data = await deleteUserHierarchyDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    console.log('UserHierarchy deleted successfully', 'info');
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while deleting UserHierarchy', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

export {
  createUserHierarchyService,
  getUserHierarchyService,
  updateUserHierarchyService,
  deleteUserHierarchyService,
};
