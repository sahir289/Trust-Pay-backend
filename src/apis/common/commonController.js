import { sendSuccess } from '../../utils/responseHandlers.js';
import { getTotalCountService } from './commonService.js';

const parseFilters = (rawFilters) => {
  if (!rawFilters) return null;

  if (typeof rawFilters === 'object') {
    return rawFilters;
  }

  if (typeof rawFilters !== 'string') {
    return null;
  }

  try {
    return JSON.parse(rawFilters);
  } catch {
    const decodedFilters = decodeURIComponent(rawFilters);
    return JSON.parse(decodedFilters);
  }
};

export const getTotalCount = async (req, res) => {
  const { tableName } = req.params;
  const role = req.body?.role ?? req.query?.role;
  const rawFilters = req.body?.filters ?? req.query?.filters;
  const { role: userRole, designation, user_id, company_id } = req.user;
  const userInfo = { userRole, designation, user_id };

  const parsedFilters = parseFilters(rawFilters);

  if (!parsedFilters) {
    const count = await getTotalCountService(
      tableName,
      role,
      { company_id },
      userInfo,
    );
    return sendSuccess(
      res,
      { count },
      `Total count for ${tableName} retrieved successfully`,
    );
  }

  const fiterId = { ...parsedFilters, company_id };
  const count = await getTotalCountService(tableName, role, fiterId, userInfo);
  return sendSuccess(
    res,
    { count },
    `Total count for ${tableName} retrieved successfully`,
  );
};
