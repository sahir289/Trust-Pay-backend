import { buildInsertQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";
import { getMerchantBankByIdService } from "../banks/bankService.js";
import { updatePayInDataService } from "./payInService.js";

const tableName = 'Payin';

export const generatePayInUrlDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const validatePayInUrlDao = async (id) => {
    const query = `SELECT * FROM "${tableName}" WHERE id=$1`;
    const result = await executeQuery(query, [id]);
    return result.rows.length ? result.rows[0] : result;
}

export const updatePayInUrlDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    console.log(result.rows);
    return result.rows[0];
}

export const getPayInDataDao = async (id) => {
    const query = `
        SELECT * FROM "${tableName}"
        WHERE id = $1
    `;
    const result = await executeQuery(query, [id]);
    return result.rows.length ? result.rows[0] : result;
};


export const expirePayInUrlDao = async (payInId) => {
    const query = `
    UPDATE "Payin"
    SET is_url_expires = true, status = 'DROPPED'
    WHERE id = $1
    RETURNING *;
`;
    const result = await executeQuery(query, [payInId]);
    return result.rows[0];
}

export const updatePayInDataDao = async (payInId, data) => {
    const query = `
        UPDATE "Payin"
        SET amount = $1,
            status = $2,
            bank_acc_id = $3,
            bank_name = $4
        WHERE id = $5
        RETURNING *;
    `;

    const result = await executeQuery(query, [
        data.amount,
        data.status,
        data.bank_acc_id,
        data.bank_name,
        payInId
    ]);

    return result.rows[0];
};



export const assignedBankToPayInUrlDao = async (payInId, bankDetails, amount) => {
    const data = {
        amount: amount,
        status: "ASSIGNED",
        bank_acc_id: bankDetails?.bankAccountId,
        bank_name: bankDetails?.bankAccount?.ac_name,
    };

    const payInUrlUpdateRes = await updatePayInDataService(payInId, data);

    const getBankRes = await getMerchantBankByIdService(payInUrlUpdateRes?.bank_acc_id);

    const updatedResData = {
        ...getBankRes,
        code: payInUrlUpdateRes?.upi_short_code,
    };

    return updatedResData;
};


export const getMerchantCodeDao = async (code) => {
    const query = `
          SELECT *
          FROM "Merchant"
          WHERE code = $1
            AND is_deleted = false
          LIMIT 1;
        `;

    const result = await executeQuery(query, [code]);
    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // If no merchant found, return null
    return null;
}

export const checkPayInStatusDao = async (payInId, merchantCode, merchantOrderId) => {
    const query = `
      SELECT p.*, m.*
      FROM "Payin" p
      JOIN "Merchant" m ON p.merchant_id = m.id
      WHERE m.code = $1
        AND p.merchant_order_id = $2
        AND ($3::varchar IS NULL OR p.id = $3)
      LIMIT 1;
    `;
    const result = await executeQuery(query, [merchantCode, merchantOrderId, payInId]);
    return result.rows.length > 0 ? result.rows[0] : result;

}