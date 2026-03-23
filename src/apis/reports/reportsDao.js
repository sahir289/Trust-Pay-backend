import { Role, Status, tableName } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { buildSelectQuery, executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

const getPayInMerchantReportDao = async (
  merchant_id,
  startDate,
  endDate,
  company_id,
  role,
  status,
  updatedPayin,
  conn = null
) => {
  try {
    let commissionSelect = `pi.payin_merchant_commission,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
      ) AS merchant_details, 
      pi.approved_at, 
      pi.created_by, 
      pi.updated_by, 
      pi.created_at, 
      pi.updated_at`;

    if (role === Role.ADMIN) {
      commissionSelect += `, v.code AS vendor_code,
      pi.payin_vendor_commission `;
    }

    let query = `
        SELECT 
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
        b.nick_name,
        ${commissionSelect},
        pi.payin_merchant_commission, r.code AS merchant_code,
        json_build_object(
            'utr', br.utr,
            'amount', br.amount
        ) AS bank_res_details
        FROM public."Payin" pi
        LEFT JOIN public."Merchant" r ON pi.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON pi.bank_acc_id = b.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        LEFT JOIN public."BankResponse" br ON pi.bank_response_id = br.id
        WHERE pi.company_id = $1 AND pi.is_obsolete = false`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (merchant_id) {
      query += ` AND pi.merchant_id = ANY($${paramIndex})`;
      parameters.push(merchant_id);
      paramIndex++;
    }
    if (status) {
      if (typeof status === 'string') {
        status = status.split(',').map((s) => s.trim());
      }
      if (!Array.isArray(status)) {
        status = [status];
      }
      query += ` AND pi.status = ANY($${paramIndex})`;
      parameters.push(status);
      paramIndex++;
    }
    if (startDate && endDate) {
      let dateColumn = 'pi.updated_at';
      if (status && Array.isArray(status) && status.includes(Status.SUCCESS)) {
        dateColumn =
          updatedPayin === 'true' ? 'pi.updated_at' : 'pi.approved_at';
      } else if (!status) {
        query += ` AND (
          (pi.status = '${Status.SUCCESS}' AND ${updatedPayin === 'true' ? 'pi.updated_at' : 'pi.approved_at'} BETWEEN $${paramIndex} AND $${paramIndex + 1})
          OR
          (pi.status != '${Status.SUCCESS}' AND pi.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
        ) ORDER BY pi.sno ASC`;
        parameters.push(startDate, endDate);
        paramIndex += 2;
        dateColumn = null;
      }
      if (dateColumn) {
        query += ` AND (${dateColumn} BETWEEN $${paramIndex} AND $${paramIndex + 1}) ORDER BY ${dateColumn === 'pi.approved_at' ? 'pi.sno' : dateColumn} ASC`;
        parameters.push(startDate, endDate);
        paramIndex += 2;
      }
    }
    const result = await executeQuery(query, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayInMerchantReportDao:', error);
    throw error;
  }
};

const getPayInVendorReportDao = async (
  id,
  startDate,
  endDate,
  company_id,
  role,
  status,
  updatedPayin,
  conn = null
) => {
  try {
    const commissionSelect = `
      pi.payin_vendor_commission,
      pi.approved_at,
      pi.created_by,
      pi.updated_by,
      pi.created_at,
      pi.updated_at`;

    let query = `
        SELECT 
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
        b.nick_name,
        v.code AS vendor_code,
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
        WHERE pi.company_id = $1 AND pi.is_obsolete = false`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (id && id.length > 0) {
      query += ` AND pi.bank_acc_id = ANY($${paramIndex})`;
      parameters.push(id);
      paramIndex++;
    }
    if (status) {
      if (typeof status === 'string') {
        status = status.split(',').map((s) => s.trim());
      }
      if (!Array.isArray(status)) {
        status = [status];
      }
      query += ` AND pi.status = ANY($${paramIndex})`;
      parameters.push(status);
      paramIndex++;
    }
    if (startDate && endDate) {
      let dateColumn = 'pi.updated_at';
      if (status && Array.isArray(status) && status.length > 0) {
        if (status.includes(Status.SUCCESS)) {
          dateColumn =
            updatedPayin === 'true' ? 'pi.updated_at' : 'pi.approved_at';
        } else {
          dateColumn = 'pi.updated_at';
        }
      } else {
        query += ` AND (
          (pi.status = '${Status.SUCCESS}' AND ${updatedPayin === 'true' ? 'pi.updated_at' : 'pi.approved_at'} BETWEEN $${paramIndex} AND $${paramIndex + 1})
          OR
          (pi.status != '${Status.SUCCESS}' AND pi.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
        ) ORDER BY pi.sno ASC`;

        parameters.push(startDate, endDate);
        paramIndex += 2;

        dateColumn = null;
      }
      if (dateColumn) {
        query += ` AND (${dateColumn} BETWEEN $${paramIndex} AND $${paramIndex + 1}) ORDER BY ${dateColumn === 'pi.approved_at' ? 'pi.sno' : dateColumn} ASC`;
        parameters.push(startDate, endDate);
        paramIndex += 2;
      }
    }

    const result = await executeQuery(query, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayInVendorReportDao:', error);
    throw error;
  }
};

const getPayOutMerchantReportDao = async (
  merchant_id,
  startDate,
  endDate,
  company_id,
  role,
  status,
  conn = null
) => {
  try {
    let commissionSelect = `po.payout_merchant_commission,
        json_build_object(
          'merchant_code', me.code,
          'return_url', me.config->>'return_url',
          'notify_url', me.config->>'notify_url'
      ) AS merchant_details, 
      po.approved_at, 
      po.created_by, 
      po.updated_by, 
      po.created_at, 
      po.updated_at`;

    if (role === Role.ADMIN) {
      commissionSelect += ` , ve.code AS vendor_code,
        po.payout_vendor_commission `;
    }
    let query = `
        SELECT 
        po.id,
        po.sno,
        po.amount,
        po.status,
        po.merchant_order_id,
        po.user,
        po.utr_id,
        po.config AS payout_details,
        json_build_object(
            'account_holder_name', po.acc_holder_name,
            'account_no', po.acc_no,
            'ifsc_code', po.ifsc_code,
            'bank_name', po.bank_name
          ) AS user_bank_details,
        b.nick_name,
        ${commissionSelect}
        FROM public."Payout" po
        LEFT JOIN public."Merchant" me ON po.merchant_id = me.id
        LEFT JOIN public."BankAccount" b ON po.bank_acc_id = b.id
        LEFT JOIN public."Vendor" ve ON ve.user_id = b.user_id
        WHERE po.company_id = $1  AND po.is_obsolete = false`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (merchant_id) {
      query += ` AND po.merchant_id =  ANY($${paramIndex})`;
      parameters.push(merchant_id);
      paramIndex++;
    }
    if (status) {
      if (typeof status === 'string') {
        status = status.split(',').map((s) => s.trim());
      }
      if (!Array.isArray(status)) {
        status = [status];
      }
      query += ` AND po.status = ANY($${paramIndex})`;
      parameters.push(status);
      paramIndex++;
    }
    if (startDate && endDate) {
      if (status && Array.isArray(status) && status.length > 0) {
        const conditions = [];
        if (
          status.includes(Status.APPROVED) ||
          status.includes(Status.REVERSED)
        ) {
          conditions.push(
            `(po.status IN ('${Status.APPROVED}', '${Status.REVERSED}') AND po.approved_at BETWEEN $${paramIndex} AND $${paramIndex + 1})`,
          );
        }
        if (status.includes(Status.REJECTED)) {
          conditions.push(
            `(po.status = '${Status.REJECTED}' AND po.rejected_at BETWEEN $${paramIndex} AND $${paramIndex + 1})`,
          );
        }
        if (
          status.includes(Status.INITIATED) ||
          status.includes(Status.PENDING)
        ) {
          conditions.push(
            `(po.status IN ('${Status.INITIATED}', '${Status.PENDING}') AND po.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})`,
          );
        }
        if (conditions.length > 0) {
          query += ` AND (${conditions.join(' OR ')})`;
          parameters.push(startDate, endDate);
          paramIndex += 2;
        }
      } else {
        query += ` AND (
          (po.status IN ('${Status.APPROVED}', '${Status.REVERSED}') AND po.approved_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
          OR
          (po.status = '${Status.REJECTED}' AND po.rejected_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
          OR
          (po.status IN ('${Status.INITIATED}', '${Status.PENDING}') AND po.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
        )`;
        parameters.push(startDate, endDate);
        paramIndex += 2;
      }
    }
    query += ` ORDER BY sno ASC;`; 
    const result = await executeQuery(query, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayOutMerchantReportDao:', error);
    throw error;
  }
};

const getPayOutVendorReportDao = async (
  id,
  startDate,
  endDate,
  company_id,
  role,
  status,
  conn = null
) => {
  try {
    let commissionSelect = '';
    if (role === Role.MERCHANT) {
      commissionSelect += `
        po.payout_merchant_commission,
        json_build_object(
          'merchant_code', me.merchant_code,
          'return_url', me.config->>'return_url',
          'notify_url', me.config->>'notify_url'
        ) AS merchant_details,
        po.created_at`;
    }
    if (role === Role.VENDOR || role === Role.SUB_VENDOR) {
      commissionSelect += `
        ve.code AS vendor_code,
        po.vendor_id,
        po.payout_vendor_commission,
        po.created_at`;
    }
    if (role === Role.ADMIN) {
      commissionSelect += `
        po.payout_merchant_commission,
        json_build_object(
          'merchant_code', me.code,
          'return_url', me.config->>'return_url',
          'notify_url', me.config->>'notify_url'
        ) AS merchant_details,
        ve.code AS vendor_code,
        po.payout_vendor_commission,
        po.approved_at,
        po.created_by,
        po.updated_by,
        po.created_at,
        po.updated_at`;
    }

    let query = `
      SELECT 
        po.id AS payout_id,
        po.sno,
        po.amount,
        po.status,
        po.merchant_order_id,
        po.user,
        po.vendor_id,
        ve.id,
        po.utr_id,
        po.config AS payout_details,
        json_build_object(
          'account_holder_name', po.acc_holder_name,
          'account_no', po.acc_no,
          'ifsc_code', po.ifsc_code,
          'bank_name', po.bank_name
        ) AS user_bank_details,
        b.nick_name,
        ${commissionSelect}
      FROM public."Payout" po
      LEFT JOIN public."Merchant" me ON po.merchant_id = me.id
      LEFT JOIN public."BankAccount" b ON po.bank_acc_id = b.id
      LEFT JOIN public."Vendor" ve ON ve.user_id = b.user_id
      WHERE po.company_id = $1 AND po.is_obsolete = false`;

    let parameters = [company_id];
    let paramIndex = 2;

    if (id && Array.isArray(id) && id.length > 0) {
      query += ` AND po.vendor_id = ANY($${paramIndex})`;
      parameters.push(id);
      paramIndex++;
    }
    if (status) {
      let statusArray = Array.isArray(status)
        ? status
        : typeof status === 'string'
          ? status.split(',').map((s) => s.trim())
          : [status];
      if (statusArray.length > 0) {
        query += ` AND po.status = ANY($${paramIndex})`;
        parameters.push(statusArray);
        paramIndex++;
      }
    }
    if (startDate && endDate) {
      if (status && Array.isArray(status) && status.length > 0) {
        const conditions = [];
        if (
          status.some((s) => [Status.APPROVED, Status.REVERSED].includes(s))
        ) {
          conditions.push(
            `(po.status IN ('${Status.APPROVED}', '${Status.REVERSED}') AND po.approved_at BETWEEN $${paramIndex} AND $${paramIndex + 1})`,
          );
        }
        if (status.includes(Status.REJECTED)) {
          conditions.push(
            `(po.status = '${Status.REJECTED}' AND po.rejected_at BETWEEN $${paramIndex} AND $${paramIndex + 1})`,
          );
        }
        if (
          status.some((s) => [Status.INITIATED, Status.PENDING].includes(s))
        ) {
          conditions.push(
            `(po.status IN ('${Status.INITIATED}', '${Status.PENDING}') AND po.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})`,
          );
        }
        if (conditions.length > 0) {
          query += ` AND (${conditions.join(' OR ')})`;
          parameters.push(startDate, endDate);
          paramIndex += 2;
        }
      } else {
        query += ` AND (
          (po.status IN ('${Status.APPROVED}', '${Status.REVERSED}') AND po.approved_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
          OR
          (po.status = '${Status.REJECTED}' AND po.rejected_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
          OR
          (po.status IN ('${Status.INITIATED}', '${Status.PENDING}') AND po.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
        )`;
        parameters.push(startDate, endDate);
        paramIndex += 2;
      }
    }

    query += ` ORDER BY sno ASC;`;
    const result = await executeQuery(query, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayOutVendorReportDao:', error);
    throw error;
  }
};

const getPayinReportDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  conn = null
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
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayOutVendorReportDao:', error);
    throw error;
  }
};

const getPayOutAll = async (filters, page, pageSize, sortBy, sortOrder, conn = null) => {
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
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayOutVendorReportDao:', error);
    throw error;
  }
};

const getMerchantReportDao = async (
  company_id,
  userIds,
  startDate,
  endDate,
  page,
  limit,
  role,
  conn = null
) => {
  try {
    if (!startDate || !endDate) {
      throw new BadRequestError('Both startDate and endDate must be provided.');
    }
    //date formatted from service
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
        COALESCE((c.config->>'total_aedSentSettlement_amount')::NUMERIC, 0)
          AS total_aed_sent_settlement_amount,
        COALESCE((c.config->>'total_bankSentSettlement_amount')::NUMERIC, 0)
          AS total_bank_sent_settlement_amount,
        COALESCE((c.config->>'total_cashSentSettlement_amount')::NUMERIC, 0)
          AS total_cash_sent_settlement_amount,
        COALESCE((c.config->>'total_cryptoSentSettlement_amount')::NUMERIC, 0)
          AS total_crypto_sent_settlement_amount,
        COALESCE((c.config->>'total_aedReceivedSettlement_amount')::NUMERIC, 0)
          AS total_aed_received_settlement_amount,
        COALESCE((c.config->>'total_bankReceivedSettlement_amount')::NUMERIC, 0)
          AS total_bank_received_settlement_amount,
        COALESCE((c.config->>'total_cashReceivedSettlement_amount')::NUMERIC, 0)
          AS total_cash_received_settlement_amount,
        COALESCE((c.config->>'total_cryptoReceivedSettlement_amount')::NUMERIC, 0)
          AS total_crypto_received_settlement_amount,
        c.total_chargeback_count,
        c.total_chargeback_amount,
        c.current_balance,
        c.net_balance,
        c.created_at, 
        c.updated_at, 
        c.total_reverse_payout_count, 
        c.total_reverse_payout_amount,
        c.total_reverse_payout_commission, 
        c.total_adjustment_amount,  
        c.company_id,
        m.code
        ${role === Role.ADMIN ? ", m.config->>'gm_code' AS gm_code, m.user_id AS merchant_user_id" : ''}
        ${role === Role.ADMIN ? ", m.config->>'gm_code' AS gm_code, m.user_id AS merchant_user_id" : ''}
      FROM public."Calculation" c
      LEFT JOIN public."Merchant" m ON c.user_id = m.user_id
      WHERE c.company_id = $1 AND c.is_obsolete = false
    `;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query += ` AND c.user_id = ANY($${paramIndex})`;
      parameters.push(userIds);
      paramIndex++;
      logger.info(
        `Filtering merchant report by specific user IDs: ${userIds.join(', ')}`,
      );
    } else {
      logger.info(
        'Retrieving merchant report data for all merchants (no specific user IDs provided)',
      );
    }
    //take indian timezone
    query += `AND c.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    parameters.push(startDate, endDate);
    paramIndex += 2;
    query += `
        ORDER BY c.id DESC, m.code ASC, c.created_at ASC
      ) 
      SELECT * FROM filtered_merchants ORDER BY code NULLS LAST`;

    // Only apply database-level pagination if both page and limit are provided
    if (page && limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      parameters.push(parseInt(limit), offset);
    }

    const result = await executeQuery(query, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchantReportDao:', error.message);
    throw error;
  }
};

const getVendorReportDao = async (
  company_id,
  userIds,
  startDate,
  endDate,
  page,
  limit,
  role,
  conn = null
) => {
  try {
    if (!startDate || !endDate) {
      throw new BadRequestError('Both startDate and endDate must be provided.');
    }
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
      COALESCE((c.config->>'total_aedSentSettlement_amount')::NUMERIC, 0)
        AS total_aed_sent_settlement_amount,
      COALESCE((c.config->>'total_bankSentSettlement_amount')::NUMERIC, 0)
        AS total_bank_sent_settlement_amount,
      COALESCE((c.config->>'total_cashSentSettlement_amount')::NUMERIC, 0)
        AS total_cash_sent_settlement_amount,
      COALESCE((c.config->>'total_internalSettlement_amount')::NUMERIC, 0)
        AS total_internal_settlement_amount,
      COALESCE((c.config->>'total_cryptoSentSettlement_amount')::NUMERIC, 0)
        AS total_crypto_sent_settlement_amount,
      COALESCE((c.config->>'total_aedReceivedSettlement_amount')::NUMERIC, 0)
        AS total_aed_received_settlement_amount,
      COALESCE((c.config->>'total_bankReceivedSettlement_amount')::NUMERIC, 0)
        AS total_bank_received_settlement_amount,
      COALESCE((c.config->>'total_cashReceivedSettlement_amount')::NUMERIC, 0)
        AS total_cash_received_settlement_amount,
      COALESCE((c.config->>'total_internalBankSettlement_amount')::NUMERIC, 0)
        AS total_internal_bank_settlement_amount,
      COALESCE((c.config->>'total_cryptoReceivedSettlement_amount')::NUMERIC, 0)
        AS total_crypto_received_settlement_amount,
      c.total_chargeback_count,
      c.total_chargeback_amount,
      c.current_balance,
      c.net_balance,
      c.created_at,
      c.updated_at,
      c.total_reverse_payout_count,
      c.total_reverse_payout_amount,
      c.total_reverse_payout_commission,
      c.total_adjustment_amount,  
      c.company_id,
      v.code
      ${role === Role.ADMIN ? ", v.config->>'gm_code' AS gm_code, v.user_id AS vendor_user_id" : ''}
      FROM public."Calculation" c
      LEFT JOIN public."Vendor" v ON c.user_id = v.user_id
      WHERE c.company_id = $1 AND c.is_obsolete = false`;

    let parameters = [company_id];
    let paramIndex = parameters.length + 1;

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query += ` AND c.user_id = ANY($${paramIndex})`;
      parameters.push(userIds);
      paramIndex++;
    }
    query += ` AND c.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    parameters.push(startDate, endDate);
    paramIndex += 2;

    query += `
      )
      SELECT * FROM filtered_vendors
      ORDER BY code ASC, created_at ASC`;

    if (page && limit) {
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      parameters.push(limit, offset);
    }

    const result = await executeQuery(query, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getVendorReportDao:', error);
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
