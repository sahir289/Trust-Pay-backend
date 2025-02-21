
import { columns } from "../../constants/index.js";
import {   executeQuery,buildSelectQuery,buildInsertQuery ,buildUpdateQuery   } from "../../utils/db.js";



const tableName = "BankResponse";

const getBankResponseDao = async ( search,
  page,
  pageSize,
  sortBy,
  sortOrder) => {
  
 const baseQuery = `SELECT * FROM "${tableName}" WHERE 1=1`;
      const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANKRESPONSE, page, pageSize, sortBy, sortOrder, typeof search != 'string');
      // Execute query
      const result = await executeQuery(sql, queryParams);
    return result.rows;
  
};





const createBankResponseDao = async (data) => {  
            // data.id = generateUUID();
       const [sql, params] = buildInsertQuery(tableName, data)
         const result = await executeQuery(sql, params);
         return result.rows[0];
};


const getBankMessageDao = async ( search,
  page,
  pageSize,
  sortBy,
  sortOrder) => {
  
 const baseQuery = `SELECT * FROM "${tableName}" WHERE 1=1`;
      const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANKRESPONSE, page, pageSize, sortBy, sortOrder, typeof search != 'string');
      // Execute query
      const result = await executeQuery(sql, queryParams);
    return result.rows;
  
};



const resetBankResponseDao = async (id,data) => { 
        const [sql, params] = buildUpdateQuery(tableName, data, { id});
        const result = await executeQuery(sql, params);
        return result.rows[0];
}


const updateBotResponseDao= async (id , data) =>{
  const [sql, params] = buildUpdateQuery(tableName, data, { id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
}


export {getBankResponseDao , createBankResponseDao ,getBankMessageDao , resetBankResponseDao, updateBotResponseDao}
