import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDaoArray } from '../merchants/merchantDao.js';
import { getVendorsDaoArray } from '../vendors/vendorDao.js';
import {
  getMerchantReportDao,
  getPayInMerchantReportDao,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getVendorReportDao,
} from './reportsDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getUsersDao } from '../users/userDao.js';
import { Role } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { s3 } from '../../helpers/Aws.js';
import { generateFile } from '../../utils/genrate-xlsx-csv.js';
import config from '../../config/config.js';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// ---------- Helper: Upload buffer/stream to S3 ----------
const uploadToS3 = async (buffer, fileName, contentType) => {
  const key = `reports/${dayjs().format('YYYY-MM-DD')}/${fileName}`;
  const putCommand = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentDisposition: `attachment; filename="${fileName}"`,
  });

  await s3.send(putCommand); 

  const getCommand = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, getCommand, {
    expiresIn: 60 * 60 * 24, // 24 hours
  });

  return {
    key,
    url: signedUrl,
  };
};

const getPayInReportService = async (req) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate, status, updatedPayin } = req.query;
    let startDateTime, endDateTime;
    if (startDate && endDate) {
      startDateTime = dayjs
        .tz(`${startDate} 00:00:00`, 'Asia/Kolkata')
        .toISOString();
      endDateTime = dayjs
        .tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata')
        .toISOString();
    }
    const codes = code.split(',');
    let merchantIds = [];
    let vendorIds = [];
    let bankIds = [];
    let result;
    const merchantDetails = await getMerchantsDaoArray(company_id, codes);
    merchantIds = merchantDetails.map((merchant) => merchant.id);
    if (merchantIds.length > 0) {
      result = await getPayInMerchantReportDao(
        merchantIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
        updatedPayin,
      );
    } else {
      const vendorDetails = await getVendorsDaoArray(company_id, codes);
      bankIds = vendorDetails.map((banks) => banks.user_id);
      const bankDetails = await getBankaccountDao(
        { user_id: bankIds },
        null,
        null,
        null,
        null,
      );
      vendorIds = bankDetails.map((merchant) => merchant.id);
      result = await getPayInVendorReportDao(
        vendorIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
        updatedPayin,
      );
    }
    return result;
  } catch (error) {
    logger.error('Error while fetching report', error);
    // Handle and rethrow errors with appropriate context
    throw error;
  }
};

const getPayOutReportService = async (req) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate, status } = req.query;
    const startDateTime = dayjs
      .tz(`${startDate} 00:00:00`, 'Asia/Kolkata')
      .toISOString();
    const endDateTime = dayjs
      .tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata')
      .toISOString();

    const codes = code.split(',');
    let merchantIds = [];
    let vendorIds = [];
    let result;
    const merchantDetails = await getMerchantsDaoArray(company_id, codes);
    merchantIds = merchantDetails.map((merchant) => merchant.id);
    if (merchantIds.length > 0) {
      result = await getPayOutMerchantReportDao(
        merchantIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
      );
    } else {
      const vendorDetails = await getVendorsDaoArray(company_id, codes);
      vendorIds = vendorDetails.map((merchant) => merchant.id);
      result = await getPayOutVendorReportDao(
        vendorIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
      );
    }
    return result;
  } catch (error) {
    logger.error('Error while fetching report', error);
    throw error;
  }
};

const getClientsAccountReportService = async (req) => {
  try {
    const { company_id, role } = req;
    const { code, startDate, endDate, role_name, page, limit, type = 'csv' } = req;

    // type validate
    const allowedTypes = ['csv', 'xlsx', 'pdf'];
    const fileType = allowedTypes.includes(type?.toLowerCase())
      ? type.toLowerCase()
      : 'csv';

    let result;
    let subMerchants = [];
    let userHierarchy = [];

    // Handle the case when code is not provided or is empty for getting all merchants
    let userIds = null;
    let requestedCodes = null;
    if (code) {
      requestedCodes =
        typeof code === 'string'
          ? code
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id) // Filter out empty strings
          : Array.isArray(code)
            ? code.filter((id) => id) // Filter out null/undefined values
            : [code].filter((id) => id); // Filter out null/undefined

      // If after filtering we have no valid codes, set requestedCodes to null
      if (requestedCodes.length === 0) {
        requestedCodes = null;
      } else {
        // Check if these are user IDs (UUIDs) or merchant codes
        const isUserIdList = requestedCodes.every(
          (code) =>
            code &&
            code.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            ),
        );

        if (isUserIdList) {
          // These are user IDs, use them directly
          userIds = requestedCodes;
          logger.info(
            `Using provided user IDs directly: ${userIds.join(', ')}`,
          );
        } else {
          // These are codes, convert to user IDs based on role_name
          if (role_name === Role.MERCHANT) {
            logger.info(
              `Converting merchant codes to user IDs: ${requestedCodes.join(', ')}`,
            );
            const merchantDetails = await getMerchantsDaoArray(
              company_id,
              requestedCodes,
            );
            if (merchantDetails.length === 0) {
              logger.warn(
                `No merchants found for codes: ${requestedCodes.join(', ')}`,
              );
              userIds = [];
            } else {
              userIds = merchantDetails.map((merchant) => merchant.user_id);
              logger.info(
                `Converted merchant codes [${requestedCodes.join(', ')}] to user IDs [${userIds.join(', ')}]`,
              );
            }
          } else if (role_name === Role.VENDOR) {
            logger.info(
              `Converting vendor codes to user IDs: ${requestedCodes.join(', ')}`,
            );
            const vendorDetails = await getVendorsDaoArray(
              company_id,
              requestedCodes,
            );
            if (vendorDetails.length === 0) {
              logger.warn(
                `No vendors found for codes: ${requestedCodes.join(', ')}`,
              );
              userIds = [];
            } else {
              userIds = vendorDetails.map((vendor) => vendor.user_id);
              logger.info(
                `Converted vendor codes [${requestedCodes.join(', ')}] to user IDs [${userIds.join(', ')}]`,
              );
            }
          }
        }
      }
    }
    // Normalize date to avoid timestamp mismatches
    const normalizeDate = (date) =>
      dayjs.tz(date, 'Asia/Kolkata').format('YYYY-MM-DD');

    if (role_name === Role.MERCHANT) {
      // First, get user hierarchy to identify parent-child relationships if we have specific userIds
      let allUserIdsToFetch = userIds;

      if (userIds && userIds.length > 0) {
        const user = await getUsersDao(
          { company_id, id: userIds },
          null,
          null,
          null,
          null,
          null,
        );
        const designation = await getDesignationDao(
          {
            id: user[0]?.designation_id,
          },
        );
        if (designation[0]?.designation === Role.MERCHANT) {
          try {
            userHierarchy = await getUserHierarchysDao(
              { user_id: userIds },
              null,
              null,
              null,
              null,
              null,
            );
            subMerchants = userHierarchy
              .filter((h) => Array.isArray(h?.config?.siblings?.sub_merchants))
              .flatMap((h) => h.config.siblings.sub_merchants);

            // Include child merchant user IDs in the fetch to ensure we get their data too
            if (subMerchants.length > 0) {
              allUserIdsToFetch = [...new Set([...userIds, ...subMerchants])];
              logger.info(
                `Including child merchant user IDs in fetch: ${subMerchants.join(', ')}`,
              );
            }
          } catch (error) {
            logger.error('Error fetching user hierarchy:', error);
          }
        }
      }

      const allMerchantData = await getMerchantReportDao(
        company_id,
        allUserIdsToFetch, // Use expanded user IDs that include children
        startDate,
        endDate,
        null, // Remove page parameter
        null, // Remove limit parameter
        role,
      );

      logger.info(
        `Retrieved ${allMerchantData.length} merchant records from database`,
      );
      if (requestedCodes && requestedCodes.length > 0) {
        logger.info(
          `Requested specific merchant codes: ${requestedCodes.join(', ')}`,
        );
        const foundCodes = allMerchantData.map((m) => m.code).filter(Boolean);
        logger.info(`Found merchant codes: ${foundCodes.join(', ')}`);
      }

      // If we don't have specific user IDs, get all user hierarchies to identify parent-child relationships
      if (!userIds || userIds.length === 0) {
        // For all merchants, we need to identify parent-child relationships
        // Get all user hierarchies to identify parent-child relationships
        try {
          const allUserIds = allMerchantData.map(
            (merchant) => merchant.calculation_user_id,
          );
          if (allUserIds.length > 0) {
            userHierarchy = await getUserHierarchysDao(
              { user_id: allUserIds },
              null,
              null,
              null,
              null,
              null,
            );
            // Extract all sub-merchants from all hierarchies (these are user IDs)
            subMerchants = userHierarchy
              .filter((h) => Array.isArray(h?.config?.siblings?.sub_merchants))
              .flatMap((h) => h.config.siblings.sub_merchants);

            logger.info(
              `Found ${subMerchants.length} sub-merchant user IDs from hierarchies: ${subMerchants.slice(0, 5).join(', ')}${subMerchants.length > 5 ? '...' : ''}`,
            );
          }
        } catch (error) {
          logger.error('Error fetching all user hierarchies:', error);
        }
      }

      const parentData = allMerchantData;
      let childData = [];

      // If we identified sub-merchants, separate parent and child data
      if (subMerchants.length > 0) {
        logger.info(
          `Found ${subMerchants.length} sub-merchants for clubbing: ${subMerchants.join(', ')}`,
        );

        // Child data (merchants that are sub-merchants)
        // Check both calculation_user_id and code for matching
        childData = parentData.filter(
          (merchant) =>
            subMerchants.includes(merchant.calculation_user_id) ||
            subMerchants.includes(merchant.code),
        );

        // Update parentData to only include parent merchants
        // Ensure we don't exclude merchants that should be parents
        const finalParentData = parentData.filter(
          (merchant) =>
            !subMerchants.includes(merchant.calculation_user_id) &&
            !subMerchants.includes(merchant.code),
        );

        logger.info(
          `Separated data - Parent records: ${finalParentData.length}, Child records: ${childData.length}`,
        );

        // Process the clubbing with separated parent and child data
        if (Array.isArray(finalParentData)) {
          // Create a map for parent data by user_id and normalized created_at
          const parentMap = {};
          finalParentData.forEach((parent) => {
            const userId = parent.calculation_user_id;
            const key = `${userId}_${normalizeDate(parent.created_at)}`;
            parentMap[key] = {
              ...parent,
              created_at: normalizeDate(parent.created_at),
              user_id: userId,
            };
          });

          // Sum child data into parent using userHierarchy for mapping
          if (
            Array.isArray(childData) &&
            Array.isArray(userHierarchy) &&
            childData.length > 0
          ) {
            // Build child-to-parent mapping from userHierarchy
            const childToParentMap = {};
            userHierarchy.forEach((h) => {
              const parentUserId = h.user_id;
              const subMerchantsArr = Array.isArray(
                h?.config?.siblings?.sub_merchants,
              )
                ? h.config.siblings.sub_merchants
                : [];
              subMerchantsArr.forEach((childUserId) => {
                // The sub_merchants array contains user_ids, not codes
                childToParentMap[childUserId] = parentUserId;
                // Also find the merchant code for this user_id and map it too
                const childMerchant = allMerchantData.find(
                  (m) => m.calculation_user_id === childUserId,
                );
                if (childMerchant && childMerchant.code) {
                  childToParentMap[childMerchant.code] = parentUserId;
                }
              });
            });

            logger.info(
              `Built child-to-parent mapping with ${Object.keys(childToParentMap).length} entries`,
            );

            childData.forEach((child) => {
              const childCodeNormalized = child.calculation_user_id;
              const childCode = child.code;

              // Try multiple approaches to find the parent
              let mappedParentUserId =
                childToParentMap[childCodeNormalized] ||
                childToParentMap[childCode];

              if (!mappedParentUserId) {
                logger.warn(
                  `Skipping child code ${childCode} (user_id: ${childCodeNormalized}) due to no valid parent user_id in childToParentMap`,
                );
                return;
              }

              // Try to find parent entry with the same date first
              const childDate = normalizeDate(child.created_at);
              let parentKey = `${mappedParentUserId}_${childDate}`;
              let parentEntry = parentMap[parentKey];

              // If no exact date match, try to find any parent entry for this user
              if (!parentEntry) {
                const alternativeKey = Object.keys(parentMap).find((key) =>
                  key.startsWith(`${mappedParentUserId}_`),
                );
                if (alternativeKey) {
                  parentEntry = parentMap[alternativeKey];
                  parentKey = alternativeKey;
                  logger.info(
                    `Using alternative parent entry for child code ${childCode}: ${alternativeKey}`,
                  );
                }
              }

              if (!parentEntry) {
                logger.warn(
                  `No parent entry found for child code ${child.code} with parent user_id ${mappedParentUserId}`,
                );
                return;
              }

              // Sum numeric fields from child to parent
              Object.keys(child).forEach((key) => {
                if (
                  key !== 'code' &&
                  key !== 'gm_code' &&
                  key !== 'parent_code' &&
                  key !== 'created_at' &&
                  key !== 'calculation_user_id' &&
                  key !== 'company_id' &&
                  key !== 'merchant_user_id' &&
                  !isNaN(parseFloat(child[key]))
                ) {
                  parentEntry[key] =
                    parseFloat(parentEntry[key] || 0) + parseFloat(child[key]);
                }
              });
              parentMap[parentKey] = parentEntry;
            });
          }

          result = Object.values(parentMap)
            .map(({ ...rest }) => rest)
            .sort((a, b) => {
              // First sort alphabetically by merchant code (case-insensitive)
              const codeA = (a.code || '').toLowerCase();
              const codeB = (b.code || '').toLowerCase();
              const codeComparison = codeA.localeCompare(codeB);

              // If merchant codes are the same, sort by date ascending (oldest first)
              if (codeComparison === 0) {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateA - dateB; // Ascending order (oldest to newest)
              }

              return codeComparison;
            });

          logger.info(`Final clubbed result contains ${result.length} records`);

          // Log which merchants are being returned after clubbing
          if (requestedCodes && requestedCodes.length > 0) {
            const returnedCodes = result.map((r) => r.code).filter(Boolean);

            // If requestedCodes were user IDs, we need to find the corresponding merchant codes for comparison
            let expectedCodes = requestedCodes;
            const isUserIdList = requestedCodes.every(
              (code) =>
                code &&
                code.match(
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                ),
            );

            if (isUserIdList) {
              // Convert user IDs to merchant codes for meaningful comparison
              expectedCodes = allMerchantData
                .filter((m) => requestedCodes.includes(m.calculation_user_id))
                .map((m) => m.code);
              logger.info(
                `Requested user IDs converted to merchant codes: ${expectedCodes.join(', ')}`,
              );
            }

            const missingCodes = expectedCodes.filter(
              (code) => !returnedCodes.includes(code),
            );
            logger.info(
              `After clubbing - Expected codes: ${expectedCodes.join(', ')}`,
            );
            logger.info(
              `After clubbing - Returned codes: ${returnedCodes.join(', ')}`,
            );
            if (missingCodes.length > 0) {
              logger.warn(
                `After clubbing - Missing codes in result: ${missingCodes.join(', ')}`,
              );
            }
          }

          // Apply pagination to the final aggregated result
          if (page && limit) {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            result = result.slice(startIndex, endIndex);
          }

          // If we searched for specific merchant codes, filter result to only include those codes
          if (requestedCodes && requestedCodes.length > 0) {
            let expectedCodes = requestedCodes;
            const isUserIdList = requestedCodes.every(
              (code) =>
                code &&
                code.match(
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                ),
            );

            if (isUserIdList) {
              // Convert user IDs to merchant codes for filtering
              expectedCodes = allMerchantData
                .filter((m) => requestedCodes.includes(m.calculation_user_id))
                .map((m) => m.code);
            }

            // Filter result to only include originally requested merchant codes
            result = result.filter((item) => expectedCodes.includes(item.code));
            logger.info(
              `Filtered final result to only include requested codes: ${result.map((r) => r.code).join(', ')}`,
            );
          }
        } else {
          result = [];
          logger.warn('finalParentData is not an array:', finalParentData);
        }
      } else {
        parentData.forEach((parent) => {
          parent.created_at = normalizeDate(parent.created_at);
          parent.user_id = parent.calculation_user_id;
        });
        // No sub-merchants found, return all data as is with alphabetical sorting and date sorting
        result = parentData.sort((a, b) => {
          // First sort alphabetically by merchant code (case-insensitive)
          const codeA = (a.code || '').toLowerCase();
          const codeB = (b.code || '').toLowerCase();
          const codeComparison = codeA.localeCompare(codeB);

          // If merchant codes are the same, sort by date ascending (oldest first)
          if (codeComparison === 0) {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateA - dateB; // Ascending order (oldest to newest)
          }

          return codeComparison;
        });
        logger.info(
          `No sub-merchants found for clubbing. Returning ${parentData.length} merchant records as-is`,
        );

        // Log which merchants are being returned
        if (requestedCodes && requestedCodes.length > 0) {
          const returnedCodes = result.map((r) => r.code).filter(Boolean);
          const missingCodes = requestedCodes.filter(
            (code) => !returnedCodes.includes(code),
          );
          logger.info(`Requested codes: ${requestedCodes.join(', ')}`);
          logger.info(`Returned codes: ${returnedCodes.join(', ')}`);
          if (missingCodes.length > 0) {
            logger.warn(`Missing codes in result: ${missingCodes.join(', ')}`);
          }
        }

        // Apply pagination if needed
        if (page && limit) {
          const pageNum = parseInt(page);
          const limitNum = parseInt(limit);
          const startIndex = (pageNum - 1) * limitNum;
          const endIndex = startIndex + limitNum;
          result = result.slice(startIndex, endIndex);
        }
      }
    } else {
      result = await getVendorReportDao(
        company_id,
        userIds, // Pass userIds directly (null for all vendors, array for specific vendors)
        startDate,
        endDate,
        page,
        limit,
        role,
      );

      // Format created_at to return date in IST format and sort alphabetically with date sorting
      if (Array.isArray(result)) {
        result = result
          .map((item) => ({
            ...item,
            created_at: normalizeDate(item.created_at),
          }))
          .sort((a, b) => {
            // First sort alphabetically by merchant code (case-insensitive)
            const codeA = (a.code || '').toLowerCase();
            const codeB = (b.code || '').toLowerCase();
            const codeComparison = codeA.localeCompare(codeB);

            // If merchant codes are the same, sort by date ascending (oldest first)
            if (codeComparison === 0) {
              const dateA = new Date(a.created_at || 0);
              const dateB = new Date(b.created_at || 0);
              return dateA - dateB; // Ascending order (oldest to newest)
            }

            return codeComparison;
          });
      }
    }

    if (!result || !Array.isArray(result) || result.length === 0) {
      return {
        success: true,
        message: 'No data found for the given filters',
        downloadUrl: null,
        totalRecords: 0,
        fileType,
      };
    }

    let buffer;
    let contentType;
    let extension;

    if (fileType === 'csv') {
      const csvContent = generateFile(result, 'csv');
      buffer = Buffer.from(csvContent, 'utf-8');
      contentType = 'text/csv';
      extension = 'csv';
    } 
    else if (fileType === 'xlsx') {
      buffer = generateFile(result, 'xlsx');
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } 
    // else if (fileType === 'pdf') {
    //   buffer = await generatePDF(result);
    //   contentType = 'application/pdf';
    //   extension = 'pdf';
    // }

    const fileName = `client_account_report_${role_name || 'all'}_${dayjs().format(
      'YYYYMMDD_HHmmss',
    )}_${uuidv4().slice(0, 8)}.${extension}`;

    const { url, key } = await uploadToS3(buffer, fileName, contentType);

    logger.info(
      `Report uploaded to S3 | Type: ${fileType} | Key: ${key} | Records: ${result.length}`,
    );

    return {
      success: true,
      message: 'Report generated successfully',
      downloadUrl: url,
      fileName,
      fileType,
      totalRecords: result.length,
      s3Key: key,
    };
  } catch (error) {
    logger.error('Error while fetching report', error);
    // Handle and rethrow errors with appropriate context
    throw error;
  }
};

export {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
};
