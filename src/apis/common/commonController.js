import { sendSuccess } from '../../utils/responseHandlers.js';
import { getTotalCountService } from './commonService.js';

export const getTotalCount = async (req, res) => {
  const { tableName } = req.params;
  const { role } = req.query;
  const count = await getTotalCountService(tableName, role);
  return sendSuccess(res, { count }, `Total count for ${tableName} retrieved successfully`);
};
