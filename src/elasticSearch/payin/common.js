import { BadRequestError } from '../../utils/appErrors.js';
import {
  buildInES,
  buildESQuery,
  updateInES,
} from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';
import { logger } from '../../utils/logger.js';
import { payinSearchableFields } from '../../constants/index.js';
const payinSearchableField = payinSearchableFields;

export const getPayinsByESSearch = async (
  query,
  filters = {},
  offset = 0,
  limit = 20,
) => {
    try {
      delete filters.search;
    // Pass searchableFields for this module
    const queryBody = buildESQuery(
      query,
      filters,
      payinSearchableField,
      offset,
      limit,
    );
    const esClient = await getESClient();
      console.log("queryBody in getPayinsByESSearch", queryBody);
    const data = await esClient.search({
      index: 'payins', // Module-specific index
      body: queryBody,
    });

    const dd = data?.hits?.hits?.map((hit) => hit._source);
    return dd;
  } catch (error) {
    logger.error('Error searching payins in Elasticsearch:', error);
    throw error;
  }
};

export const createPayinInES = async (payins) => {
  try {
    // Validate input
    if (!payins || !payins.id) {
      throw new BadRequestError('User object must have an id property');
    }
    // ensure only relevant fields are indexed (optional, based on your mappings)
    // const userDoc = {
    //   full_name: payins.full_name,
    //   user_name: payins.user_name,
    //   code: payins.code,
    //   contact_no: payins.contact_no,
    //   designation: payins.designation,
    //   email: payins.email,
    //   is_enabled: payins.is_enabled,
    //   created_at: payins.created_at,
    // };
    console.log(payins,"hehy");
    const result = await buildInES(
      payins.id,
      payins,
      'payins',
    ); // 'payins' is the index name

    return {
      success: true,
      id: payins.id,
      result: result.body, // Return indexing result (like:- { result: 'created' })
    };
  } catch (error) {
    logger.error('Error indexing payins in Elasticsearch:', error);
    throw error;
  }
};

export const updatePayinInES = async (id, updateData) => {
  try {
    // Validate input
    if (!id) {
      throw new BadRequestError('payin ID is required');
    }
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestError('Update data cannot be empty');
    }
    const result = await updateInES(id, 'payins', updateData);
    return {
      success: true,
      id,
      result: result.body,
    };
  } catch (error) {
    logger.error(`Error updating payin with ID ${id} in Elasticsearch:`, error);
    throw error;
  }
};