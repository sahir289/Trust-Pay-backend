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
    let commissionSelect = `pi.payin_merchant_commission,
      pi.payin_vendor_commission, 
      v.code AS vendor_code,
      pi.approved_at, 
      pi.created_by, 
      pi.updated_by, 
      pi.created_at, 
      pi.updated_at`;

    let query = `
WITH filtered_payins AS (
        SELECT DISTINCT ON (pi.id)
        pi.id,
        pi.sno,
        pi.upi_short_code,
        pi.amount,
        pi.status,
        pi.merchant_order_id,
        pi.is_notified,
        pi.user_submitted_utr,
        pi.user,
        pi.user_submitted_image,
        pi.duration,
        pi.config AS payin_details,
        b.nick_name, m.code AS merchant_code,
        ${commissionSelect},
        json_build_object(
            'utr', br.utr,
            'amount', br.amount
        ) AS bank_res_details
        FROM public."Payin" pi
        LEFT JOIN public."Merchant" m ON pi.merchant_id = m.id
        LEFT JOIN public."BankAccount" b ON pi.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON pi.bank_response_id = br.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        WHERE pi.company_id = $1`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (id) {
      query += ` AND pi.bank_acc_id = $${paramIndex}`;
      parameters.push(id);
      paramIndex++;
    }

    if (startDate && endDate) {
      query += ` AND pi.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
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

const getPayOutMerchantReportDao = async (
  merchant_id,
  startDate,
  endDate,
  company_id,
) => {
  try {
    let commissionSelect = `po.payout_merchant_commission,
        json_build_object(
          'merchant_code', me.code,
          'return_url', me.config->>'return_url',
          'notify_url', me.config->>'notify_url'
      ) AS merchant_details, 
      po.payout_vendor_commission, 
      po.approved_at, 
      po.created_by, 
      po.updated_by, 
      po.created_at, 
      po.updated_at`;

    let query = `
WITH filtered_payins AS (
        SELECT DISTINCT ON (po.id)
        po.id,
        po.sno,
        po.amount,
        po.status,
        po.merchant_order_id,
        po.user,
        ve.code as vendor_code,
        po.config AS payout_details,
        b.nick_name,
        ${commissionSelect},
         json_build_object(
            'account_holder_name', po.acc_holder_name,
            'account_no', po.acc_no,
            'ifsc_code', po.ifsc_code,
            'bank_name', po.bank_name
          ) AS user_bank_details
        FROM public."Payout" po
        LEFT JOIN public."Merchant" me ON po.merchant_id = me.id
        LEFT JOIN public."BankAccount" b ON po.bank_acc_id = b.id
        LEFT JOIN public."Vendor" ve ON ve.user_id = b.user_id
        WHERE po.company_id = $1`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (merchant_id) {
      query += ` AND po.merchant_id = $${paramIndex}`;
      parameters.push(merchant_id);
      paramIndex++;
    }

    if (startDate && endDate) {
      query += ` AND po.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
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
    let commissionSelect = `po.payout_merchant_commission,
    json_build_object(
      'merchant_code', me.code,
      'return_url', me.config->>'return_url',
      'notify_url', me.config->>'notify_url'
  ) AS merchant_details, 
  po.payout_vendor_commission, 
  po.approved_at, 
  po.created_by, 
  po.updated_by, 
  po.created_at, 
  po.updated_at`;

let query = `
WITH filtered_payins AS (
    SELECT DISTINCT ON (po.id)
    po.id,
    po.sno,
    po.amount,
    po.status,
    po.merchant_order_id,
    po.user,
    ve.code as vendor_code,
    po.config AS payout_details,
    b.nick_name,
    ${commissionSelect},
     json_build_object(
        'account_holder_name', po.acc_holder_name,
        'account_no', po.acc_no,
        'ifsc_code', po.ifsc_code,
        'bank_name', po.bank_name
      ) AS user_bank_details
    FROM public."Payout" po
    LEFT JOIN public."Merchant" me ON po.merchant_id = me.id
    LEFT JOIN public."BankAccount" b ON po.bank_acc_id = b.id
    LEFT JOIN public."Vendor" ve ON ve.user_id = b.user_id
    WHERE po.company_id = $1`;

let parameters = [company_id];
let paramIndex = parameters.length + 1;

if (id) {
  query += ` AND po.vendor_id = $${paramIndex}`;
  parameters.push(id);
  paramIndex++;
}

if (startDate && endDate) {
  query += ` AND po.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
  parameters.push(startDate, endDate);
}

query += `) SELECT * FROM filtered_payins;`;

const result = await executeQuery(query, parameters);
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

const getMerchantReportDao = async (company_id, userIds, startDate, endDate, page, limit) => {
  try {
    if (!startDate || !endDate) {
      throw new Error("Both startDate and endDate must be provided.");
    }   
    let query = `
      WITH filtered_merchants AS (
        SELECT DISTINCT ON (c.id)
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
    if (userIds) {
      query += ` AND c.user_id = ANY($${paramIndex})`;
      parameters.push(userIds);
      paramIndex++;
    }
    
    query += ` AND c.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    parameters.push(startDate, endDate);
    paramIndex += 2;    
    query += `
        ORDER BY c.id, m.code ASC
      ) 
      SELECT * FROM filtered_merchants ORDER BY code NULLS LAST`;    
    if (page && limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      parameters.push(parseInt(limit), offset);
    }

    const result = await executeQuery(query, parameters);
    return result.rows;
  } catch (error) {
    console.error("Error in getMerchantReportDao:", error.message);
    throw new Error(error.message);
  }
};


const getVendorReportDao = async (
  company_id,
  userIds,
  startDate,
  endDate,
  page,
  limit
) => {
  try {
    if (!startDate || !endDate) {
      throw new Error("Both startDate and endDate must be provided.");
    }
    //date formatting
    let query = `
WITH filtered_vendors AS (
  SELECT DISTINCT ON (c.id)
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
    v.code,
    v.user_id AS vendor_user_id
  FROM public."Calculation" c
  LEFT JOIN public."Vendor" v ON c.user_id = v.user_id
  WHERE c.company_id = $1`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (userIds) {
      query += ` AND c.user_id = ANY($${paramIndex})`;
      parameters.push(userIds);
      paramIndex++;
    }

    query += ` AND c.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    parameters.push(
      startDate,
      endDate
    );
    paramIndex += 2;

    query += `
    ORDER BY c.id, v.code ASC
)
SELECT * FROM filtered_vendors
ORDER BY code ASC NULLS LAST`;

    if (page && limit) {
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      parameters.push(limit, offset);
    }

    const result = await executeQuery(query, parameters);
    return result.rows;
  } catch (error) {
    console.error("Error in getVendorReportDao:", error);
    throw error.message || error;
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
