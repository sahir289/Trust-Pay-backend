import { BadRequestError } from '../../utils/appErrors.js';
import {
  buildInES,
  buildESQuery,
  updateInES,
} from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';
import { logger } from '../../utils/logger.js';
import { PayoutSearchableFields } from '../../constants/index.js';
const PayoutSearchableField = PayoutSearchableFields;

export const getPayoutByESSearch = async (
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
      PayoutSearchableField,
      offset,
      limit,
    );
    const esClient = await getESClient();
    const data = await esClient.search({
      index: 'payouts', // Module-specific index
      body: queryBody,
    });
    const dd = data?.hits?.hits?.map((hit) => hit._source);
    return dd;
  } catch (error) {
    logger.error('Error searching payout in Elasticsearch:', error);
    throw error;
  }
};

export const createPayoutInES = async (payout) => {
  try {
    // Validate input
    if (!payout || !payout.id) {
      throw new BadRequestError('User object must have an id property');
    }
    // ensure only relevant fields are indexed (optional, based on your mappings)
    // const userDoc = {
    //   full_name: payout.full_name,
    //   user_name: payout.user_name,
    //   code: payout.code,
    //   contact_no: payout.contact_no,
    //   designation: payout.designation,
    //   email: payout.email,
    //   is_enabled: payout.is_enabled,
    //   created_at: payout.created_at,
    // };
    const result = await buildInES(payout.id, payout, 'payouts');
    return {
      success: true,
      id: payout.id,
      result: result.body, // Return indexing result (like:- { result: 'created' })
    };
  } catch (error) {
    logger.error('Error indexing payout in Elasticsearch:', error);
    throw error;
  }
};

export const updatePayoutInES = async (id, updateData) => {
  try {
    // Validate input
    if (!id) {
      throw new BadRequestError('payout ID is required');
    }
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestError('Update data cannot be empty');
    }
    const result = await updateInES(id, 'payouts', updateData);
    return {
      success: true,
      id,
      result: result.body,
    };
  } catch (error) {
    logger.error(`Error updating payout with ID ${id} in Elasticsearch:`, error);
    throw error;
  }
};