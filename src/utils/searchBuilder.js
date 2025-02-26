import { tableName as dbTables } from "../constants/index.js";

const DataTypes = {
    STRING: "string",
    NUMBER: "number",
    BOOLEAN: "boolean",
}

const tables = {
    [dbTables.MERCHANT]: {
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
        code: DataTypes.STRING,
        min_payin: DataTypes.NUMBER,
        max_payin: DataTypes.NUMBER,
        payin_commission: DataTypes.NUMBER,
        min_payout: DataTypes.NUMBER,
        max_payout: DataTypes.NUMBER,
        payout_commission: DataTypes.NUMBER,
        is_test_mode: DataTypes.BOOLEAN,
        is_enabled: DataTypes.BOOLEAN,
        dispute_enabled: DataTypes.BOOLEAN,
        is_demo: DataTypes.BOOLEAN,
        balance: DataTypes.NUMBER,
    }
}

/**
 * Searches for a value in the specified table column.
 * 
 * @param {string} search - The search term.
 * @param {string} tableName - Table Name to build filter for
 * @example
 * searchInTable("first_name", "Merhcant");
 * searchInTable("first_name, last_name", "Merhcant");
 */
export const buildSearchFilterObj = (search, tableName) => {

    if (typeof search !== 'string') {
        throw new Error('Invalid Search Type');
    }

    const obj = tables[tableName];

    if(!obj){
        throw new Error('Search table not found!')
    }

    const filters = {};
    const values = search.split(",");
    for(const v of values){
        const toValue = v.trim();
        if(!toValue){
            continue;
        }
        const valueType = ["true", "false"].includes(toValue) ? DataTypes.BOOLEAN : !isNaN(toValue) ? DataTypes.NUMBER : DataTypes.STRING;
        for(const column in obj){
            // console.log({ columnType: obj[column], valueType, column })
            // match column type
            if(obj[column] === valueType){
                if(filters[column]){
                    // check if array then push it
                    if(Array.isArray(filters[column])){
                        filters[column].push(toValue);
                        continue;
                    }
                    // if values exist then make it array to use ANY
                    filters[column] = [filters[column], toValue]
                    continue;
                }
                // first add direct value to avoid ANY query
                filters[column] = toValue;
            }
        }
    }


    return filters;
}