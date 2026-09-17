/**
 * Super Admin Bootstrap Script
 *
 * Creates a global super-admin user assigned to a "System" company with
 * scope = 'global'.  The system company ID is generated dynamically via
 * PostgreSQL's uuid_generate_v4() — no hardcoded UUIDs.
 *
 * The System company avoids company_id = NULL which would break the entire
 * auth/session flow (getSessionByIdDao, getLoginDao, cache keys, etc.).
 *
 * Usage:
 *   npm run create:super-admin
 *
 * Required env vars:
 *   SUPER_ADMIN_EMAIL, SUPER_ADMIN_USERNAME, SUPER_ADMIN_FIRST_NAME,
 *   SUPER_ADMIN_LAST_NAME, SUPER_ADMIN_CONTACT_NO
 *
 * Optional env vars:
 *   DATABASE_WRITER_URL (PostgreSQL connection string)
 */

import dotenv from 'dotenv';
dotenv.config();
import { v4 as uuidv4 } from 'uuid';

import { Role, DesignationIs } from '../src/constants/index.js';
import { createUserDao } from '../src/apis/users/userDao.js';
import { getRoleDao, createRoleDao } from '../src/apis/roles/rolesDao.js';
import {
  getDesignationDao,
  createDesignationDao,
} from '../src/apis/designation/designationDao.js';
import { createHash } from '../src/utils/bcryptPassword.js';
import {
  beginTransaction,
  commit,
  executeQuery,
  getConnection,
  rollback,
} from '../src/utils/db.js';
import { generatePassword } from '../src/utils/generatePassword.js';
import { sendCredentialsEmail } from '../src/utils/sendMailer.js';
import { logger } from '../src/utils/logger.js';

/**
 * Idempotent: ensures the "System" company (scope = 'global') exists.
 * Returns the system company ID for use in user creation.
 *
 * First looks for an existing global-scope company. If none is found,
 * generates a new UUID v4 via PostgreSQL and inserts it.
 */
const ensureSystemCompany = async (conn) => {
  // Check if a global-scope system company already exists
  const existing = await executeQuery(
    `SELECT id FROM public."Company" WHERE scope = 'global' LIMIT 1`,
    [],
    conn,
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Generate a new UUID via PostgreSQL
  const uuidResult = uuidv4();
  const systemCompanyId = uuidResult;

  await executeQuery(
    `INSERT INTO public."Company" (id, first_name, last_name, email, contact_no, config, is_obsolete, scope)
     VALUES ($1, '$2', '$3', $4, $5, '{}', false, 'global')
     ON CONFLICT (id) DO NOTHING`,
    [
      systemCompanyId,
      process.env.SUPER_ADMIN_FIRST_NAME,
      process.env.SUPER_ADMIN_LAST_NAME,
      process.env.SUPER_ADMIN_EMAIL,
      process.env.SUPER_ADMIN_CONTACT_NO,
    ],
    conn,
  );

  return systemCompanyId;
};

const requiredEnvironmentVariables = [
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_USERNAME',
  'SUPER_ADMIN_FIRST_NAME',
  'SUPER_ADMIN_LAST_NAME',
  'SUPER_ADMIN_CONTACT_NO',
];

const validateEnvironment = () => {
  const missingVariables = requiredEnvironmentVariables.filter(
    (variable) => !process.env[variable]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }
};

/**
 * Idempotent get-or-create for any Role (inside a transaction).
 * Uses SAVEPOINT so a 23505 INSERT doesn't abort the outer tx.
 */
const getOrCreateRole = async (roleName, conn) => {
  const roles = await getRoleDao(
    { role: roleName },
    null, null, null, null,
    undefined,
    conn,
  );
  if (roles.length > 0) return roles[0];

  await executeQuery('SAVEPOINT sp_create_role', [], conn);
  try {
    return await createRoleDao({ role: roleName }, conn);
  } catch (err) {
    if (err.code !== '23505') throw err;
    await executeQuery('ROLLBACK TO SAVEPOINT sp_create_role', [], conn);
    const retry = await getRoleDao(
      { role: roleName },
      null, null, null, null,
      undefined,
      conn,
    );
    return retry[0];
  }
};

/**
 * Seeds all predefined roles from constants.
 */
const seedAllRoles = async (conn) => {
  const roleNames = Object.values(Role);
  for (const roleName of roleNames) {
    await getOrCreateRole(roleName, conn);
    logger.info(`Role seeded: ${roleName}`);
  }
};

/**
 * Idempotent get-or-create for any Designation (inside a transaction).
 * Same SAVEPOINT pattern using existing getDesignationDao/createDesignationDao.
 * Now includes role_id since Designation table has NOT NULL constraint on role_id.
 */
const getOrCreateDesignation = async (designationName, conn, roleId) => {
  const designations = await getDesignationDao(
    { designation: designationName },
    conn,
  );
  if (designations.length > 0) return designations[0];

  await executeQuery('SAVEPOINT sp_create_desig', [], conn);
  try {
    return await createDesignationDao(
      { designation: designationName, role_id: roleId },
      conn,
    );
  } catch (err) {
    if (err.code !== '23505') throw err;
    await executeQuery('ROLLBACK TO SAVEPOINT sp_create_desig', [], conn);
    const retry = await getDesignationDao(
      { designation: designationName },
      conn,
    );
    return retry[0];
  }
};

/**
 * Seeds all predefined designations from constants.
 * Passes role_id from corresponding Role since Designation.table has NOT NULL constraint.
 */
const seedAllDesignations = async (conn) => {
  const role = await getOrCreateRole(Role.SUPER_ADMIN, conn);
  const designationNames = Object.values(DesignationIs);
  for (const designationName of designationNames) {
    await getOrCreateDesignation(designationName, conn, role.id);
    logger.info(`Designation seeded: ${designationName}`);
  }
};

const getGlobalSuperAdminByUsername = async (username, conn) => {
  const result = await executeQuery(
    `SELECT u.id, u.user_name
     FROM public."User" u
     JOIN public."Role" r ON u.role_id = r.id
     WHERE u.user_name = $1
       AND r.role = $2
       AND u.is_obsolete = false`,
    [username, Role.SUPER_ADMIN],
    conn,
  );

  return result.rows[0];
};

const createSuperAdmin = async () => {
  validateEnvironment();

  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    // 0. Ensure sentinel "System" company exists
    const systemCompanyId = await ensureSystemCompany(conn);

    // 1. Seed all roles and designations
    await seedAllRoles(conn);
    await seedAllDesignations(conn);

    // 2. Fetch the SUPER_ADMIN role & designation for user creation
    const role = await getOrCreateRole(Role.SUPER_ADMIN, conn);
    const designation = await getOrCreateDesignation(
      DesignationIs.SUPER_ADMIN,
      conn,
      role.id,
    );

    // 3. Idempotency check — bail if super admin already exists
    const existingUser = await getGlobalSuperAdminByUsername(
      process.env.SUPER_ADMIN_USERNAME,
      conn,
    );

    if (existingUser) {
      await commit(conn);
      committed = true;
      logger.info(
        `Super admin already exists: ${existingUser.id} (${existingUser.user_name})`,
      );
      return;
    }

    // 3. Create user + send email (all inside the same tx)
    const password = generatePassword(process.env.SUPER_ADMIN_USERNAME);
    const user = await createUserDao(
      {
        role_id: role.id,
        designation_id: designation.id,
        first_name: process.env.SUPER_ADMIN_FIRST_NAME,
        last_name: process.env.SUPER_ADMIN_LAST_NAME,
        email: process.env.SUPER_ADMIN_EMAIL,
        contact_no: process.env.SUPER_ADMIN_CONTACT_NO,
        user_name: process.env.SUPER_ADMIN_USERNAME,
        password: await createHash(password),
        is_enabled: true,
        company_id: systemCompanyId,
        config: { isLoginFirst: true },
      },
      conn,
    );

    await sendCredentialsEmail({
      email: user.email,
      username: user.user_name,
      password,
      role: Role.SUPER_ADMIN,
      designation: DesignationIs.SUPER_ADMIN,
    });

    await commit(conn);
    committed = true;
    logger.info(`Super admin created: ${user.id} (${user.user_name})`);
    logger.info(`Credentials sent to: ${user.email}`);
    logger.info(`Initial password: ${password}`);
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error(`Failed to create super admin: ${error.message}`, error);
    process.exit(1);
  } finally {
    conn?.release();
  }
};

await createSuperAdmin();
process.exit(0);
