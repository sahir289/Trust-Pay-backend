import { tableName } from '../../constants/index.js';
import {
  buildJoinQuery,
  buildSelectQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getPayInMerchantReportDao = async (
  merchant_id,
  startDate,
  endDate,
  company_id
) => {
  try {
    let commissionSelect = `u.payin_merchant_commission,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
      ) AS merchant_details, 
      u.payin_vendor_commission, 
      u.approved_at, 
      u.created_by, 
      u.updated_by, 
      u.created_at, 
      u.updated_at`;

    let query = `
WITH filtered_payins AS (
        SELECT DISTINCT ON (u.id)
        u.id,
        u.sno,
        u.upi_short_code,
        u.amount,
        u.status,
        u.merchant_order_id,
        u.is_notified,
        u.user_submitted_utr,
        u.user,
        u.user_submitted_image,
        u.duration,
        u.config AS payin_details,
        b.nick_name,
        ${commissionSelect},
        json_build_object(
            'utr', br.utr,
            'amount', br.amount
        ) AS bank_res_details
        FROM public."Payin" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON u.bank_response_id = br.id
        WHERE u.company_id = $1`;
    
    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (merchant_id) {
      query += ` AND u.merchant_id = $${paramIndex}`;
      parameters.push(merchant_id);
      paramIndex++;
    }

    if (startDate && endDate) {
      query += ` AND u.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      parameters.push(startDate, endDate);
    }

    query += `) SELECT * FROM filtered_payins;`;

    const result = await executeQuery(query, parameters);
    return result.rows;
  } catch (error) {
    console.error("Error in getPayInMerchantReportDao:", error);
    throw new Error(error.message);
  }
};


const getPayInVendorReportDao = async (id, startDate, endDate, company_id) => {
  try {
    let commissionSelect = `u.payin_merchant_commission,
      u.payin_vendor_commission, 
      v.code AS vendor_code,
      u.approved_at, 
      u.created_by, 
      u.updated_by, 
      u.created_at, 
      u.updated_at`;

    let query = `
WITH filtered_payins AS (
        SELECT DISTINCT ON (u.id)
        u.id,
        u.sno,
        u.upi_short_code,
        u.amount,
        u.status,
        u.merchant_order_id,
        u.is_notified,
        u.user_submitted_utr,
        u.user,
        u.user_submitted_image,
        u.duration,
        u.config AS payin_details,
        b.nick_name,
        ${commissionSelect},
        json_build_object(
            'utr', br.utr,
            'amount', br.amount
        ) AS bank_res_details
        FROM public."Payin" u
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON u.bank_response_id = br.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        WHERE u.company_id = $1`;
    
    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (id) {
      query += ` AND u.id = $${paramIndex}`;
      parameters.push(id);
      paramIndex++;
    }

    if (startDate && endDate) {
      query += ` AND u.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      parameters.push(startDate, endDate);
    }

    query += `) SELECT * FROM filtered_payins;`;

    const result = await executeQuery(query, parameters);
    return result.rows;
  } catch (error) {
    console.error("Error in getPayInMerchantReportDao:", error);
    throw new Error(error.message);
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
    let query = `SELECT merchant_order_id, ifsc_code, payout_merchant_commission,
    amount, utr_id, status, bank_acc_id, merchant_id  FROM  "Payout" WHERE 1=1`;
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
    return result.rows;
  } catch (error) {
    console.error('Error in getPayOutMerchantReportDao:', error);
    throw error.message;
  }
};

const getPayOutVendorReportDao = async (id, startDate, endDate, company_id) => {
  try {
    let query = `SELECT merchant_order_id, ifsc_code, payout_vendor_commission,
    amount, utr_id, status, bank_acc_id, merchant_id  FROM  "Payout" WHERE 1=1`;
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
    return result.rows;
  } catch (error) {
    console.error('Error in getPayOutVendorReportDao:', error);
    throw error.message;
  }
};

const getPayinReportDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  try {
    const baseQuery = `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getPayOutVendorReportDao:', error);
    throw error.message;
  }
};


const getPayOutAll = async (filters, page, pageSize, sortBy, sortOrder) => {
  try {
    const baseQuery = `SELECT merchant_order_id, ifsc_code, payout_vendor_commission, payout_merchant_commission,
    amount, utr_id, status, bank_acc_id, merchant_id
    FROM "${tableName.PAYOUT}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getPayOutVendorReportDao:', error);
    throw error.message;
  }
};

const getMerchantReportDao = async (
  filters,
  startDate,
  endDate,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { CALCULATION, MERCHANT } = tableName;
    const joins = [
      {
        table: MERCHANT,
        // first is source key
        // second is target key
        keys: 'user_id',
        type: 'JOIN',
        columns: ['user_id', 'code'],
        columnAs: [`"${MERCHANT}".user_id AS calculation_user_id`],
      },
    ];
    let baseQuery = buildJoinQuery(
      CALCULATION,
      columns.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, CALCULATION);
      delete filters.search;
    }
   
    // console.log(JSON.stringify(filters, undefined, 4));
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CALCULATION,
    );
    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams[`created_at_start`] = startDate;
      queryParams[`created_at_end`] = endDate;
    }
    
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getMerchantReportDao:', error);
    throw error.message;
  }
};

const getVendorReportDao = async (
  filters,
  startDate,
  endDate,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { VENDOR, CALCULATION } = tableName;

    const joins = [
      {
        table: VENDOR,
        // first is source key
        // second is target key
        keys: 'user_id',
        type: 'JOIN',
        columns: ['user_id', 'code'],
        columnAs: [`"${VENDOR}".user_id AS vendor_user_id`],
      },
    ];

    let baseQuery = buildJoinQuery(
      CALCULATION,
      columns.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, CALCULATION);
      delete filters.search;
    }
    // console.log(JSON.stringify(filters, undefined, 4));
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CALCULATION,
    );

    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams['created_at_start'] = startDate;
      queryParams['created_at_end'] = endDate;
    }

    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getVendorReportDao:', error);
    throw error.message;
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
