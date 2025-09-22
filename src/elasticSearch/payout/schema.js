// import { getIndexName } from '../../utils/buildElasticSearch.js';
import getESClient from '../../utils/elasticClient.js';

export const createPayoutIndex = async () => {
  const esClient = await getESClient();
  const exists = await esClient.indices.exists({ index: 'payouts' });
  if (!exists) {
    await esClient.indices.create({
      index: 'payouts',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            sno: { type: 'integer' },
            user: { type: 'keyword' },
            merchant_id: { type: 'keyword' },
            vendor_id: { type: 'keyword' },
            bank_acc_id: { type: 'keyword' },
            amount: { type: 'double' },
            status: { type: 'keyword', fields: { text: { type: 'text' } } },
            failed_reason: { type: 'text' },
            currency: { type: 'keyword' },
            merchant_order_id: { type: 'keyword' },
            acc_no: { type: 'keyword', fields: { text: { type: 'text' } } },
            acc_holder_name: {
              type: 'keyword',
              fields: { text: { type: 'text' } },
            },
            ifsc_code: { type: 'keyword', fields: { text: { type: 'text' } } },
            bank_name: { type: 'keyword', fields: { text: { type: 'text' } } },
            upi_id: { type: 'keyword', fields: { text: { type: 'text' } } },
            utr_id: { type: 'keyword' },
            rejected_reason: { type: 'text' },
            payout_merchant_commission: { type: 'double' },
            payout_vendor_commission: { type: 'double' },
            approved_at: { type: 'date' },
            rejected_at: { type: 'date' },
            config: { type: 'object' },
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
};

export const getPayoutIndex = async (payout) => {
  const esClient = await getESClient();
  const { body } = await esClient.get({
    index: 'payouts',
    id: payout.id,
    document: {
      ...payout,
    },
  });
  return body._source;
};
