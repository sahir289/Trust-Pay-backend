import { BadRequestError } from '../../utils/appErrors.js';
import {
  buildInES,
  buildESQuery,
  updateInES,
} from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';
import { logger } from '../../utils/logger.js';
import { SettlementSearchableFields } from '../../constants/index.js';
const SettlementSearchableField = SettlementSearchableFields;

export const getSettlementByESSearch = async (
  query,
  filters = {},
  offset = 0,
  limit = 20,
) => {
  try {
    // Pass searchableFields for this module
    delete filters.search;
    const queryBody = buildESQuery(
      query,
      filters,
      SettlementSearchableField,
      offset,
      limit,
    );
    const esClient = await getESClient();
    const data = await esClient.search({
      index: 'settlements', // Module-specific index
      body: queryBody,
    });
    const dd = data?.hits?.hits?.map((hit) => hit._source);
    return dd;
  } catch (error) {
    logger.error('Error searching settlement in Elasticsearch:', error);
    throw error;
  }
};

export const createSettlementInES = async (settlement) => {
  try {
    // Validate input
    if (!settlement || !settlement.id) {
      throw new BadRequestError('User object must have an id property');
    }
    // ensure only relevant fields are indexed (optional, based on your mappings)
    // const userDoc = {
    //   full_name: settlement.full_name,
    //   user_name: settlement.user_name,
    //   code: settlement.code,
    //   contact_no: settlement.contact_no,
    //   designation: settlement.designation,
    //   email: settlement.email,
    //   is_enabled: settlement.is_enabled,
    //   created_at: settlement.created_at,
    // };
    const result = await buildInES(settlement.id, settlement, 'settlements');
    return {
      success: true,
      id: settlement.id,
      result: result.body, // Return indexing result (like:- { result: 'created' })
    };
  } catch (error) {
    logger.error('Error indexing settlement in Elasticsearch:', error);
    throw error;
  }
};

export const updatesettlementInES = async (id, updateData) => {
  try {
    // Validate input
    if (!id) {
      throw new BadRequestError('settlement ID is required');
    }
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestError('Update data cannot be empty');
    }
    const result = await updateInES(id, 'settlements', updateData);
    return {
      success: true,
      id,
      result: result.body,
    };
  } catch (error) {
    logger.error(`Error updating settlement with ID ${id} in Elasticsearch:`, error);
    throw error;
  }
};