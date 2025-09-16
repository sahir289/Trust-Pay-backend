// import { getIndexName } from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';

export const createBankResponseIndex = async () => {
  const esClient = await getESClient();
  const exists = await esClient.indices.exists({ index: 'bankresponse' });
  if (!exists) {
    await esClient.indices.create({
      index: 'bankresponse',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            sno: { type: 'double'},
            status: { type: 'keyword', fields: { text: { type: 'text' } } },
            bank_id: { type: 'keyword' },
            amount: { type: 'integer' },
            upi_short_code: {
              type: 'keyword',
              fields: { text: { type: 'text' } },
            },
            utr: { type: 'keyword', fields: { text: { type: 'text' } } },
            is_used: { type: 'boolean' },
            nick_name: { type: 'keyword', fields: { text: { type: 'text' } } },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            created_by: { type: 'keyword' },
            company_id: { type: 'keyword' },
            is_obsolete: { type: 'boolean' },
            config: { type: 'object' },
            updated_by: { type: 'keyword' },
          },
        },
      },
    });
  }
};

export const getBankResponseIndex = async (bankResponse) => {
  const esClient = await getESClient();
  const { body } = await esClient.get({
    index: 'bankresponse',
    id: bankResponse.id,
    document: {
      ...bankResponse
    //   full_name: `${bankResponse.first_name} ${bankResponse.last_name}`,
    },
  });
  return body._source;
};
