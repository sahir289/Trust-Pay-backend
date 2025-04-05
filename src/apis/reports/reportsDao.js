import { tableName } from '../../constants/index.js';
import {
  buildSelectQuery,
  executeQuery,
} from '../../utils/db.js';

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
  merchant_id,
  startDate,
  endDate,
  company_id,
) => {
  try {
    let commissionSelect = `u.payout_merchant_commission,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
      ) AS merchant_details, 
      u.payout_vendor_commission, 
      ve.code as vendor_code,
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
        u.amount,
        u.status,
        u.merchant_order_id,
        u.user,
        u.config AS payin_details,
        b.nick_name,
        ${commissionSelect},
         json_build_object(
            'account_holder_name', u.acc_holder_name,
            'account_no', u.acc_no,
            'ifsc_code', u.ifsc_code,
            'bank_name', u.bank_name
          ) AS user_bank_details
        FROM public."Payout" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
       LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        LEFT JOIN public."Vendor" ve ON u.vendor_id = ve.id
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

const getMerchantReportDao = async (user_id, startDate, endDate, company_id, page, limit) => {
  try {
    console.log(user_id, startDate, endDate, company_id, page, limit, "Executing getMerchantReportDao");

    if (!startDate || !endDate) {
      throw new Error("Both startDate and endDate must be provided.");
    }

    const formattedStartDate = new Date(startDate);
    const formattedEndDate = new Date(endDate);

    if (isNaN(formattedStartDate.getTime()) || isNaN(formattedEndDate.getTime())) {
      throw new Error("Invalid date format for startDate or endDate");
    }

    let query = `
      WITH filtered_merchants AS (
        SELECT DISTINCT ON (c.id)
          c.id,
          c.user_id AS calculation_user_id,
          c.total_payin_count,
          c.total_payin_amount,
          c.total_payin_commission,
          c.total_payout_count,
          c.total_payout_amount,
          c.total_payout_commission,
          c.total_settlement_count,
          c.total_settlement_amount,
          c.total_chargeback_count,
          c.total_chargeback_amount,
          c.current_balance,
          c.net_balance,
          c.created_at, 
          c.updated_at, 
          c.total_reverse_payout_count, 
          c.total_reverse_payout_amount,
          c.total_reverse_payout_commission, 
          m.code, 
          m.user_id AS merchant_user_id
        FROM public."Calculation" c
        LEFT JOIN public."Merchant" m ON c.user_id = m.user_id
        WHERE c.company_id = $1
    `;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (user_id) {
      query += ` AND c.user_id = $${paramIndex}`;
      parameters.push(user_id);
      paramIndex++;
    }

    query += ` AND c.created_at BETWEEN $${paramIndex}::TIMESTAMPTZ AND $${paramIndex + 1}::TIMESTAMPTZ 
      ORDER BY c.id, m.code ASC
    ) 
    SELECT * FROM filtered_merchants ORDER BY code NULLS LAST`;

    parameters.push(
      formattedStartDate.toISOString(),
      formattedEndDate.toISOString()
    );

    if (page && limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2};`;
      parameters.push(parseInt(limit), offset);
    }

    console.log("Executing Query:", query, "Parameters:", parameters);

    const result = await executeQuery(query, parameters);
    return result.rows;
  } catch (error) {
    console.error("Error in getMerchantReportDao:", error.message);
    throw new Error(error.message);
  }
};


const getVendorReportDao = async (
  user_id,
  startDate,
  endDate,
  company_id, page, limit
) => {
  try {
console.log(startDate, endDate, "startenddateindao")
    if (!startDate || !endDate) {
      throw new Error("Both startDate and endDate must be provided.");
    }

    const formattedStartDate = new Date(startDate);
    const formattedEndDate = new Date(endDate);

    if (isNaN(formattedStartDate.getTime()) || isNaN(formattedEndDate.getTime())) {
      throw new Error("Invalid date format for startDate or endDate");
    }

    let query = `
WITH filtered_vendors AS (
    SELECT DISTINCT ON (c.id)
    c.id,
    c.user_id,
    c.total_payin_count,
    c.total_payin_amount,
    c.total_payin_commission,
    c.total_payout_count,
    c.total_payout_amount,
    c.total_payout_commission,
    c.total_settlement_count,
    c.total_settlement_amount,
    c.total_chargeback_count,
    c.total_chargeback_amount,
    c.current_balance,
    c.net_balance,
    c.created_at, c.updated_at, 
    c.total_reverse_payout_count, c.total_reverse_payout_amount,
    c.total_reverse_payout_commission, v.code, v.user_id
    FROM public."Calculation" c
    LEFT JOIN public."Vendor" v ON c.user_id = v.user_id
    WHERE c.company_id = $1`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (user_id) {
      query += ` AND c.user_id = $${paramIndex}`;
      parameters.push(user_id);
      paramIndex++;
    }

    query += ` AND c.created_at BETWEEN $${paramIndex}::TIMESTAMPTZ AND $${paramIndex + 1}::TIMESTAMPTZ 
      ORDER BY c.id, v.code ASC
    ) SELECT * FROM filtered_merchants`;

    parameters.push(
      formattedStartDate.toISOString(),
      formattedEndDate.toISOString()
    );

    if (page && limit) {
      const offset = (page - 1) * limit;
      query += ` ORDER BY code ASC LIMIT $${paramIndex + 2} OFFSET $${paramIndex + 3};`;
      parameters.push(limit, offset);
    }

    const result = await executeQuery(query, parameters);
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
