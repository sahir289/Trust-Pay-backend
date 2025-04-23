import { sendSuccess } from '../../utils/responseHandlers.js';
import { getTotalCountService } from './commonService.js';

export const getTotalCount = async (req, res) => {
  const { tableName } = req.params;
  const { role, filters } = req.query;
  const { role: userRole, designation, user_id, company_id } = req.user;
  const userInfo = { userRole, designation, user_id };
   if (filters === undefined) {
    const count = await getTotalCountService(tableName, role,{company_id} ,userInfo);
    return sendSuccess(
      res,
      { count },
      `Total count for ${tableName} retrieved successfully`,
    );
  }
  const filtersObject = decodeURIComponent(filters);
  let filter = JSON.parse(filtersObject);
  filter = {...filter,company_id}
  const count = await getTotalCountService(tableName, role, filter, userInfo);
  return sendSuccess(
    res,
    { count },
    `Total count for ${tableName} retrieved successfully`,
  );
}; 