import { tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const generatePayInUrlDao = async (data) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.PAYIN, data);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error generating PayIn URL:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}

export const getPayInUrlDao = async (filters) => {
    try {
        const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`, filters);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting PayIn URL:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}

export const getPayInsDao = async (conn, payload) => {
    let baseQuery = `SELECT 
    u.id AS payin_id, u.sno, u.upi_short_code, u.amount, u.status, u.is_notified, u.user_submitted_utr, 
    u.merchant_order_id, u.user, u.payin_merchant_commission, u.payin_vendor_commission, u.user_submitted_image ,
    u.duration, u.approved_at,  u.created_by, u.updated_by, u.created_at, u.updated_at, u.config AS payin_config,
    
    v.code AS vendor_code, v.id AS vendor_id, v.user_id AS vendor_user_id,
    b.id AS bank_table_id, b.user_id, b.nick_name ,
    r.code AS merchant_code, r.id AS merchant_table_id, r.config,
    br.id AS bank_res_id, br.bank_id, br.amount AS bank_res_amount, br.utr

FROM public."Payin" u
LEFT JOIN public."Merchant" r 
    ON u.merchant_id = r.id
LEFT JOIN public."BankAccount" b
    ON b.id = u.bank_acc_id
LEFT JOIN public."BankResponse" br
    ON br.bank_id = u.bank_acc_id
LEFT JOIN public."Vendor" v 
    ON v.user_id = (
         SELECT b.user_id 
         FROM public."BankAccount" b 
         WHERE b.id = u.bank_acc_id
    )
WHERE u.is_obsolete = false AND u.company_id = $1
LIMIT 10 OFFSET $2;
;
`

let payindata=[] ;
    const queryParams = [payload.company_id, payload.page];
    const result = await conn.query(baseQuery, queryParams);
    const dataIs = result.rows;
    for(const res of dataIs){        
        payindata.push( {
           id: res.payin_id ,
           sno: res.sno,
           upi_short_code: res.upi_short_code,
           amount: res.amount,
           status: res.status,
           is_notified: res.is_notified,
           user_submitted_utr: res.user_submitted_utr,
           merchant_order_id: res.merchant_order_id,
           user: res.user,
           bank_account : res.nick_name,
           merchant: {[res.merchant_code]: res.payin_config},
           vendor: res.vendor_code,
            bank_response: {amount : res.bank_res_amount, utr: res.utr} ,
           payin_merchant_commission: res.payin_merchant_commission,
           payin_vendor_commission: res.payin_vendor_commission,
           user_submitted_image: res.user_submitted_image,
           duration: res.duration,
           approved_at: res.approved_at,   
           created_by: res.created_by,
           updated_by: res.updated_by,
           created_at: res.created_at,
           updated_at: res.updated_at,  
       })
       
    }    
     return payindata;

}


export const getPayInUrlsDao = async (filters = {}) => {
    try {
        const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`, filters);
        const result = await executeQuery(sql, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting PayIn URLs:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}

export const updatePayInUrlDao = async (id, data, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating PayIn URL:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}
