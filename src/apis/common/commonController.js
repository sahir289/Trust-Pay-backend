import { sendSuccess } from '../../utils/responseHandlers.js';
import { getTotalCountService } from './commonService.js';

export const getTotalCount = async (req, res) => {
  const { tableName } = req.params;
  const count = await getTotalCountService(tableName);
  return sendSuccess(res, { count }, `Total count for ${tableName} retrieved successfully`);
};
