// import { getIndexName } from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';

export const createPayinIndex = async () => {
  const esClient = await getESClient();
  const exists = await esClient.indices.exists({ index: 'payins' });
  if (!exists) {
    await esClient.indices.create({
      index: 'payins',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            sno: { type: 'integer' }, 
            upi_short_code: {
              type: 'keyword',
              fields: { text: { type: 'text' } },
            },
            qr_params: { type: 'keyword' },
            amount: { type: 'double' }, 
            status: { type: 'keyword', fields: { text: { type: 'text' } } },
            is_notified: { type: 'boolean' }, 
            user_submitted_utr: {
              type: 'keyword',
              fields: { text: { type: 'text' } },
            },
            currency: { type: 'keyword' }, 
            merchant_order_id: { type: 'keyword' }, 
            user: { type: 'keyword' }, 
            bank_acc_id: { type: 'keyword' },
            merchant_id: { type: 'keyword' }, 
            bank_response_id: { type: 'keyword' }, 
            payin_merchant_commission: { type: 'double' }, 
            payin_vendor_commission: { type: 'double' },
            user_submitted_image: { type: 'keyword' }, 
            duration: { type: 'keyword' }, 
            is_url_expires: { type: 'boolean' }, 
            expiration_date: { type: 'date' }, 
            one_time_used: { type: 'boolean' },
            approved_at: { type: 'date' }, 
            failed_at: { type: 'date' }, 
            config: { type: 'object' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            company_id: { type: 'keyword' },
            is_obsolete: { type: 'boolean' },
            created_by: { type: 'keyword' },
            updated_by: { type: 'keyword' }
          },
        },
      },
    });
  }
};

export const getPayinIndex = async (payins) => {
  const esClient = await getESClient();
  const { body } = await esClient.get({
    index: 'payins',
    id: payins.id,
    document: {
      ...payins
    },
  });
  return body._source;
};
