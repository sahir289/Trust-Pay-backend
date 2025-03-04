import { tableName } from '../../constants/index.js';
import { buildJoinQuery, buildSelectQuery, executeQuery } from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getPayInMerchantReportDao = async (
  merchant_id,
  startDate,
  endDate,
  company_id,
) => {
  try {
    const tableName = 'Payin';
    let query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, {
      merchant_id: merchant_id,
      company_id: company_id,
    });
    if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, parameters);
    return result.rows[0];
  } catch (error) {
    console.error('Error in getPayInMerchantReportDao:', error);
    throw error;
  }
};

const getPayInVendorReportDao = async (id, startDate, endDate, company_id) => {
  try {
    const tableName = 'Payin';
    let query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(
      query,
      { bank_acc_id: id },
      { company_id: company_id },
    );
    if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, parameters);
    return result.rows;
  } catch (error) {
    console.error('Error in getPayInVendorReportDao:', error);
    throw error;
  }
};

// const getPayOutAll = async (
//    search,
//    user,
//    page,
//    pageSize,
//    sortBy,
//    sortOrder
//  ) => {
//    const baseQuery = `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`;
//    const [sql, queryParams] = buildSelectQuery(
//      baseQuery,
//      search,
//      columns.PAYIN,
//      page,
//      pageSize,
//      sortBy,
//      sortOrder,
//      typeof search !== "string",
//      user
//    );
//    const result = await executeQuery(sql, queryParams);
//     return result.rows.length > 0 ? result.rows : null;
//  };

const getPayOutMerchantReportDao = async (
  id,
  startDate,
  endDate,
  company_id,
) => {
  try {
    let query = `SELECT *  FROM  "Payout" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, {
      merchant_id: id,
      company_id: company_id,
    });
    if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, parameters);
    console.log(result.rows[0], sql, parameters, 'payinsss');
    return result.rows;
  } catch (error) {
    console.error('Error in getPayOutMerchantReportDao:', error);
    throw error;
  }
};

const getPayOutVendorReportDao = async (id, startDate, endDate, company_id) => {
  try {
    let query = `SELECT *  FROM  "Payout" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, {
      bank_acc_id: id,
      company_id: company_id,
    });
    if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, parameters);
    console.log(result.rows[0], sql, parameters, 'payinsss');
    return result.rows;
  } catch (error) {
    console.error('Error in getPayOutVendorReportDao:', error);
    throw error;
  }
};

const getPayinReportDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  const baseQuery = `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(
    baseQuery,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
  );
  console.log(sql, queryParams, 'gfhcjhgvbh');
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const getPayOutAll = async (filters, page, pageSize, sortBy, sortOrder) => {
  const baseQuery = `SELECT * FROM "${tableName.PAYOUT}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(
    baseQuery,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
  );
  console.log(sql, queryParams, 'gfhcjhgvbh');
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};


const getMerchantReportDao = async (
   filters,
   startDate, endDate,
   page,
   pageSize,
   sortBy,
   sortOrder,
   columns = [],) => {
   try {
      const { CALCULATION, MERCHANT } = tableName;

      const joins =
         [{
            table: MERCHANT,
            // first is source key
            // second is target key
            keys: 'user_id',
            type: "JOIN",
            columns: ["user_id", 'code'],
            columnAs: [`"${MERCHANT}".user_id AS calculation_user_id`],

         }
         ]
      let baseQuery = buildJoinQuery(CALCULATION, columns.length ? columns : "*", joins);
      if (filters.search) {
         filters.or = buildSearchFilterObj(filters.search, CALCULATION);
         delete filters.search;
      }
      // console.log(JSON.stringify(filters, undefined, 4));
      const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder, tableName.CALCULATION);
      if (startDate && endDate) {
         baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
         queryParams[`created_at_start`] = startDate;
         queryParams[`created_at_end`] = endDate;
      }
      const result = await executeQuery(sql, queryParams);
      return result.rows;
   } catch (error) {
      console.error('Error in getMerchantReportDao:', error);
      throw error;
   }
};

const getVendorReportDao = async (
   filters,
   startDate, endDate,
   page,
   pageSize,
   sortBy,
   sortOrder,
   columns = [],) => {
   try {
      const { VENDOR, CALCULATION } = tableName;

      const joins =
         [{
            table: VENDOR,
            // first is source key
            // second is target key
            keys: 'user_id',
            type: "JOIN",
            columns: ["user_id"],
            columnAs: [`"${VENDOR}".user_id AS vendor_user_id`],

         }]

      let baseQuery = buildJoinQuery(CALCULATION, columns.length ? columns : "*", joins);
      if (filters.search) {
         filters.or = buildSearchFilterObj(filters.search, CALCULATION);
         delete filters.search;
      }
      // console.log(JSON.stringify(filters, undefined, 4));
      const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder, tableName.CALCULATION);

      if (startDate && endDate) {
         baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
         queryParams['created_at_start'] = startDate;
         queryParams['created_at_end'] = endDate;
      }

      const result = await executeQuery(sql, queryParams);
      console.log(result.rows, sql, queryParams, baseQuery, "ashghgjasgd");

      return result.rows;

   } catch (error) {
      console.error('Error in getVendorReportDao:', error);
      throw error;
   }
};

export {
  getPayInMerchantReportDao,
  getPayinReportDao,
  getPayOutAll,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getMerchantReportDao,
  getVendorReportDao,
};
