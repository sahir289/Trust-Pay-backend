const getUserRoom = (userId) => `user:${userId}`;
const getSessionRoom = (sessionId) => `session:${sessionId}`;
const getCompanyRoom = (companyId) => `company:${companyId}`;
const getVendorRoom = (companyId, vendorCode) => `vendor:${companyId}:${vendorCode}`;

export { getCompanyRoom, getSessionRoom, getUserRoom, getVendorRoom };
