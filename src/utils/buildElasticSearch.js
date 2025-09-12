import esClient from '../utils/elasticClient.js';

export const buildESQuery = (
  searchQuery,
  filters = {},
  searchableFields = [],
  offset = 0,
  limit = 20,
) => {
  const queryBody = {
    query: {
      bool: {
        must: [],
        filter: [],
      },
    },
    from: offset,
    size: limit,
    sort: [{ created_at: 'desc' }],
  };

  // Add multi_match only if searchQuery is provided
  if (searchQuery) {
    queryBody.query.bool.must.push({
      multi_match: {
        query: searchQuery, // like "code user_name" or "UTR12345"
        fields: searchableFields, // module-specific fields like (['full_name^2', 'user_name']) here Boost full_name
        operator: 'or', // it matches any term you can change to 'and' for stricter matching
        type: 'best_fields', // it scores based on best-matching field
      },
    });
  }

  // handles term filters (like:- is_enabled: 'true') and date ranges (like:- created_at_start/end)
  Object.entries(filters).forEach(([key, value]) => {
    if (key.endsWith('_start') || key.endsWith('_end')) {
      // handle date range filters (like:- created_at_start, created_at_end -> range on 'created_at') we can use this in future if needed
      const field = key.replace(/_start|_end$/, '');
      const rangeFilter = queryBody.query.bool.filter.find(
        (f) => f.range && f.range[field],
      );
      if (!rangeFilter) {
        queryBody.query.bool.filter.push({ range: { [field]: {} } });
      }
      const newRange = queryBody.query.bool.filter.find(
        (f) => f.range && f.range[field],
      ).range[field];
      if (key.endsWith('_start')) newRange.gte = value; // here greater than or equal
      if (key.endsWith('_end')) newRange.lte = value; // less than or equal
    } else {
      // this is default to term filter for exact matches (like:- is_enabled: 'true', status: 'active')
      queryBody.query.bool.filter.push({ term: { [key]: value } });
    }
  });

  // If no must clauses, add match_all for pure filtering/pagination
  if (queryBody.query.bool.must.length === 0) {
    queryBody.query.bool.must.push({ match_all: {} });
  }

  return queryBody;
};


export const buildESIndex = async(reqId, reqData) => {
  const data = await esClient.index({
    index: 'users',
    id: reqId.toString(), // convert ID to string (Elasticsearch IDs are strings)
    document: reqData // use filtered object
  });
  return data;
}