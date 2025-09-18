// import { getIndexName } from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';

export const createSettlementIndex = async () => {
  try {
    const esClient = await getESClient();
    const exists = await esClient.indices.exists({ index: 'settlements' });
    if (!exists) {
      await esClient.indices.create({
        index: 'settlements',
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              sno: { type: 'integer' },
              user_id: { type: 'keyword' },
              status: { type: 'keyword', fields: { text: { type: 'text' } } },
              amount: { type: 'double' },
              method: { type: 'keyword', fields: { text: { type: 'text' } } },
              config: { type: 'object' },
              approved_at: { type: 'date' },
              rejected_at: { type: 'date' },
              created_by: { type: 'keyword' },
              updated_by: { type: 'keyword' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' },
              company_id: { type: 'keyword' },
              is_obsolete: { type: 'boolean' },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Failed to create settlement index:', error.message);
    throw error;
  }
};

export const getSettlementIndex = async (settlement) => {
  try {
    const esClient = await getESClient();
    const { body } = await esClient.get({
      index: 'settlements',
      id: settlement.id,
      document: {
        ...settlement,
      },
    });
    return body._source;
  } catch (error) {
    console.error('Failed to get settlement document:', error.message);
    throw error;
  }
};
