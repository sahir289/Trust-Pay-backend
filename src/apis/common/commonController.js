import { sendSuccess } from '../../utils/responseHandlers.js';
import { getTotalCountService } from './commonService.js';

export const getTotalCount = async (req, res) => {
  const { tableName } = req.params;
  const { role } = req.query;
  const { filters } = req.query;
  if(filters === undefined) {
    const count = await getTotalCountService(tableName, role);
    return sendSuccess(res, { count }, `Total count for ${tableName} retrieved successfully`);
  }
  const filtersObject = decodeURIComponent(filters);
  let filter = JSON.parse(filtersObject);
  const count = await getTotalCountService(tableName, role, filter);
  return sendSuccess(res, { count }, `Total count for ${tableName} retrieved successfully`);
};
