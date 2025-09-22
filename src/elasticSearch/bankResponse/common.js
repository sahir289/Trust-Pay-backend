import { BadRequestError } from '../../utils/appErrors.js';
import {
  buildInES,
  buildESQuery,
  updateInES,
} from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';
import { logger } from '../../utils/logger.js';
import { bankResponseSearchableFields } from '../../constants/index.js';
const bankResponseSearchableField = bankResponseSearchableFields;

export const getBankResponseByESSearch = async (
  query,
  filters = {},
  offset = 0,
    limit = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
) => {
  try {
    delete filters.search;

    const queryBody = buildESQuery(
      query,
      filters,
      bankResponseSearchableField,
      offset,
      limit,
      sortBy,
      sortOrder
    );

    const esClient = await getESClient();

    const data = await esClient.search({
      index: 'bankresponse',
      body: queryBody,
    });

    const results = data?.hits?.hits?.map((hit) => hit._source) || [];

    const totalCount = data?.hits?.total?.value || 0;

    const totalPages = Math.ceil(totalCount / limit);

    return {
      results,
      totalCount,
      totalPages,
    };
  } catch (error) {
    logger.error('Error searching bankResponse in Elasticsearch:', error);
    throw error;
  }
};
  

export const createBankResponseInES = async (bankResponse) => {
  try {
    // Validate input
    if (!bankResponse || !bankResponse.id) {
      throw new BadRequestError('User object must have an id property');
    }
    // ensure only relevant fields are indexed (optional, based on your mappings)
    // const userDoc = {
    //   full_name: bankResponse.full_name,
    //   user_name: bankResponse.user_name,
    //   code: bankResponse.code,
    //   contact_no: bankResponse.contact_no,
    //   designation: bankResponse.designation,
    //   email: bankResponse.email,
    //   is_enabled: bankResponse.is_enabled,
    //   created_at: bankResponse.created_at,
    // };

    const result = await buildInES(bankResponse.id, bankResponse, 'bankresponse'); // 'bankResponse' is the index name

    return {
      success: true,
      id: bankResponse.id,
      result: result.body, // Return indexing result (like:- { result: 'created' })
    };
  } catch (error) {
    logger.error('Error indexing bankResponse in Elasticsearch:', error);
    throw error;
  }
};


export const updateBankResponseInES = async (id, updateData) => {
  try {
    // Validate input
    if (!id) {
      throw new BadRequestError('Bank response ID is required');
    }
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestError('Update data cannot be empty');
    }
    const result = await updateInES(id, 'bankresponse', updateData);
    return {
      success: true,
      id,
      result: result.body,
    };
  } catch (error) {
    logger.error(
      `Error updating bankResponse with ID ${id} in Elasticsearch:`,
      error,
    );
    throw error;
  }
};