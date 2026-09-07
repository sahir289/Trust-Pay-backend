import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { logger } from '../../utils/logger.js';

/**
 * Middleware for super-admin routes that require tenant (company) scoping.
 *
 * Reads the `x-tenant-id` header, verifies the company exists in the
 * database (and is not obsolete), then injects the company ID into
 * `req.user` so downstream services/DAOs can filter data by company
 * as usual.
 *
 * Only applies when the authenticated user is a SUPER_ADMIN — for other
 * roles `req.user.company_id` is already set from the JWT token.
 */
const setSuperAdminTenant = async (req, res, next) => {
  try {
    const tenantId = req.header('x-tenant-id');

    if (!tenantId || !tenantId.trim()) {
      throw new BadRequestError('x-tenant-id header is required');
    }

    const companyId = tenantId.trim();

    // Cross-check with the Company table to ensure the company exists
    const company = await getCompanyByIDDao({ id: companyId });

    if (!company) {
      throw new NotFoundError(
        `Company not found for x-tenant-id: ${companyId}`,
      );
    }

    // Inject the company scope so downstream services/DAOs work transparently
    req.user.company_id = companyId;

    next();
  } catch (error) {
    logger.error('Error in setSuperAdminTenant middleware:', error);
    next(error);
  }
};

export { setSuperAdminTenant };
