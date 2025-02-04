import { DbError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';
import { generateUUID } from '../../utils/generateUUID.js';

const logger = new Logger();

export const createBankDao=async (conn,payload)=>{;
try {  
    const value=payload;
    const id=generateUUID();
    const sql = `INSERT INTO "Public"."BankAccount" (
        id, upi_id, upi_params, name, ac_no, ac_name, ifsc, bank_name, 
        is_qr, is_bank, min_payin, max_payin, is_enabled, payin_count, 
        balance, bank_used_for, config, created_by, created_at, updated_at, 
        is_obsolete, sno, today_balance, company_id, user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
`;
    // console.log(value,"from dao")
const values = [
        id, value.upi_id, value.upi_params, value.name, value.ac_no, value.ac_name, value.ifsc, value.bank_name,
        value.is_qr, value.is_bank, value.min_payin, value.max_payin, value.is_enabled, value.payin_count, value.balance,
        value.bank_used_for, value.config, value.created_by, value.created_at, value.updated_at, value.is_obsolete,
        value.sno, value.today_balance,value.company_id,value.user_id
    ];
    console.log("create bank api is working but error in DB")
    const data = await conn.query(sql,values);
    // console.log(data,"data in db")
    return data;
  } catch (error) {
    logger.log('error getting while creating bank in Dao', 'error', error);
    throw new DbError('Error executing query to Create Bank Dao');
  }
}

export const getBankByIdDao = async (conn, id) => {
    try {
        console.log("get bank by ID API is working but error in DB");
        const sql = 'SELECT * FROM Public.BankAccount WHERE id = $1';
        const { rows } = await conn.query(sql, [id]); 

        return rows;
    } catch (error) {
        logger.log('Error while getting bank from DB', 'error', error);
        throw new DbError('Error executing query to get Bank');
    }
};

export const getBankDao = async (conn) => {
    try {
        console.log("get all bank api is working but error in DB")
        const sql = 'SELECT * FROM Public.BankAccount';  
        console.log("Fetching all bank records in try")
        const data = await conn.query(sql);
        return data.rows;  
    } catch (error) {
        logger.log('Error while getting all banks', 'error', error);
    }
};

export const updateBankDao = async (conn, payload, id) => {
    try {
        
        const sql = `
            UPDATE Public.BankAccount
            SET
                upi_id = $1,
                upi_params = $2,
                name = $3,
                ac_no = $4,
                ac_name = $5,
                ifsc = $6,
                bank_name = $7,
                is_qr = $8,
                is_bank = $9,
                min_payin = $10,
                max_payin = $11,
                is_enabled = $12,
                payin_count = $13,
                balance = $14,
                bank_used_for = $15,
                config = $16,
                created_by = $17,
                created_at = $18,
                updated_at = NOW(),
                is_obsolete = $19,
                sno = $20,
                today_balance = $21,
                company_id = $22,
                user_id = $23
            WHERE id = $24
            RETURNING *;  
        `;

       
        const values = [
            payload.upi_id,
            payload.upi_params,
            payload.name,
            payload.ac_no,
            payload.ac_name,
            payload.ifsc,
            payload.bank_name,
            payload.is_qr,
            payload.is_bank,
            payload.min_payin,
            payload.max_payin,
            payload.is_enabled,
            payload.payin_count,
            payload.balance,
            payload.bank_used_for,
            payload.config,
            payload.created_by,
            payload.created_at,   
            payload.is_obsolete,
            payload.sno,
            payload.today_balance,
            payload.company_id,
            payload.user_id,
            id  
        ];
        console.log("Update bank api is working but error in DB")
        const data = await conn.query(sql, values);
        return data;  
    } catch (error) {
        logger.log('error updating bank account', 'error', error);
        throw new DbError('Error executing update query on BankAccount');
    }
};


export const deleteBankDao=async (conn,id)=>{
    console.log(id)
    try{
    console.log(id)
    const sql = 'UPDATE Public.BankAccount SET is_obsolete = $1 WHERE id = $2';
    const values=[true,id]
    console.log("delete bank api is working but error in DB")
    const data = await conn.query(sql, values);;
    if (data) {
        return { success: true, message: `Record with ID ${id} deleted.` };
    } else {
        return { success: false, message: `No record found with ID ${id}.` };
    }
    }
    catch(error){
        logger.log('error getting while deleting bank', 'error', error);
        throw new DbError('Error executing query to deleting bank');
    }
    }
