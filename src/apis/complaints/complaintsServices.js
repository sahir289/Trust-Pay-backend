import { BadRequestError } from '../../utils/appErrors.js';
import { getComplaintsDao, createComplaintsDao, updateComplaintsDao, deleteComplaintsDao } from './complaintsDao.js';

// Service to get complaints
const getComplaintsService = async (filters) => {
    try {
        const data = await getComplaintsDao(filters);
        return data;
    } catch (error) {
        console.error('Error while fetching complaints', error);
        throw new BadRequestError('Error occurred while fetching complaints');
    }
}

// Service to create a new complaint
const createComplaintsService = async (payload) => {
    try {
        const data = await createComplaintsDao(payload);
        return data;
    } catch (error) {
        console.error('Error while creating complaint', error);
        throw new BadRequestError('Error occurred while creating complaint');
    }
}

// Service to update an existing complaint
const updateComplaintsService = async (id,company_id, body) => {
    try {
        if (!body || !id) {
            throw new BadRequestError('Missing required fields: body or id');
        }
        const data = await updateComplaintsDao({id,company_id}, body);
        return data;
    } catch (error) {
        console.error('Error while updating complaint', error);
        throw new BadRequestError('Error occurred while updating complaint');
    }
}

// Service to delete a complaint
const deleteComplaintsService = async (id,company_id, userData) => {
    try {
        const data = await deleteComplaintsDao({id,company_id}, userData);
        return data;
    } catch (error) {
        console.error('Error while deleting complaint', error);
        throw new BadRequestError('Error occurred while deleting complaint');
    }
}

export { getComplaintsService, createComplaintsService, updateComplaintsService, deleteComplaintsService };
