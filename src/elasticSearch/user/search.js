import { userFields } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { buildESIndex, buildESQuery } from '../../utils/buildElasticSearch.js';
import esClient from '../../utils/elasticClient.js';
import { logger } from '../../utils/logger.js';

const userSearchableFields = userFields;

export const getUsersByESSearch = async (
  query,
  filters = {},
  offset = 0,
  limit = 20,
) => {
  try {
    // Pass searchableFields for this module
    const queryBody = buildESQuery(
      query,
      filters,
      userSearchableFields,
      offset,
      limit,
    );
    const data = await esClient.search({
      index: 'users', // Module-specific index
      body: queryBody,
    });
    // Optional: Process hits (like:- return data.hits.hits.map(hit => hit._source)) we can add like this as well, if needed

    //   const dd = data.hits.hits.map(hit => ({
    //     id: hit._id, // Include Elasticsearch ID
    //     score: hit._score, // Include relevance score
    //     ...hit._source, // Spread user data
    //     created_at: new Date(hit._source.created_at).toISOString() // Format date
    //   }));
    const dd =  data.hits.hits.map((hit) => hit._source);
    console.log(dd, "ddd here");
    return dd;
  } catch (error) {
    logger.error('Error searching users in Elasticsearch:', error);
    throw error;
  }
};

export const createUserInES = async (user) => {
  try {
    // Validate input
    if (!user || !user.id) {
      throw new BadRequestError('User object must have an id property');
    }
    console.log(user, "user here");
    // ensure only relevant fields are indexed (optional, based on your mappings)
    // const userDoc = {
    //   full_name: user.full_name,
    //   user_name: user.user_name,
    //   code: user.code,
    //   contact_no: user.contact_no,
    //   designation: user.designation,
    //   email: user.email,
    //   is_enabled: user.is_enabled,
    //   created_at: user.created_at,
    // };

    const result = await buildESIndex(user.id, user);

    return {
      success: true,
      id: user.id,
      result: result.body, // Return indexing result (like:- { result: 'created' })
    };
  } catch (error) {
    logger.error('Error indexing user in Elasticsearch:', error);
    throw error;
  }
};
