import Logger from "../../utils/logger.js";
import { sendError } from "../../utils/responseHandlers.js";

const logger = new Logger();


const getRoleDao = async (conn, filters = {}) => {
    console.log('getRoles3');
    let sql = 'SELECT * FROM Role WHERE 1=1';
    const conditions = [];
    const queryParams = [];
    const filtersMap = {
        id: 'id',
        role: 'role',
        createdBy: 'created_by',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        isObsolete: 'is_obsolete',
        companyId: 'company_id',
    };
    for (const [key, column] of Object.entries(filtersMap)) {
        const value = filters[key];
        if (value !== undefined && value !== null) {
            conditions.push(`${column} = $${queryParams.length + 1}`);
            queryParams.push(value);
        }
    }
    if (conditions.length) {
        sql += ` AND ${conditions.join(' AND ')}`;
    }

    try {
        const { rows } = await conn.query(sql, queryParams);
        return rows;
    } catch (error) {
        logger.error('Error fetching Roles', error);

        throw new sendError('Failed to fetch Roles');
    }
};


const createRoleDao = async (conn, payload) => {            
    console.log('createRole3');
    const { role, createdBy, companyId } = payload;
    const sql = `INSERT INTO Role (role, created_by, company_id) VALUES ($1, $2, $3) RETURNING *`;
    const values = [role, createdBy, companyId];    
    try {
        const { rows } = await conn.query(sql, values);
        return rows[0];
    } catch (error) {
        logger.error('Error creating Role', error);
        throw new sendError('Failed to create Role');
    }   
}


const updateRoleDao = async (conn, payload) => {        
    console.log('updateRole3');
    const { id, role, updatedBy } = payload;
    const sql = `UPDATE Role SET role = $1, updated_by = $2 WHERE id = $3 RETURNING *`;
    const values = [role, updatedBy, id];
    try {
        const { rows } = await conn.query(sql, values);
        return rows[0];
    } catch (error) {
        logger.error('Error updating Role', error);
        throw new sendError('Failed to update Role');
    }
}


const deleteRoleDao = async (conn, payload) => { 
    console.log('deleteRole3');
    const { id } = payload;
    const sql = `UPDATE FROM Role WHERE id = $1 RETURNING *`;
    const values = [id];
    try {
        const { rows } = await conn.query(sql, values);
        return rows[0];
    } catch (error) {
        logger.error('Error deleting Role', error);
        throw new sendError('Failed to delete Role');
    }
}


export { getRoleDao, createRoleDao, updateRoleDao, deleteRoleDao};