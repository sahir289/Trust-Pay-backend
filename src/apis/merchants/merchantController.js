import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
  getMerchantsService,
  getMerchantsServiceCode,
  updateMerchantService,
} from './merchantService.js';
import {
  VALIDATE_UPDATE_MERCHANT_STATUS,
  VALIDATE_MERCHANT_SCHEMA,
} from '../../schemas/merchantSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
const createMerchant = async (req, res) => {
  let payload = req.body;
  const Secret = generateUUID();
  const Public = generateUUID();
 payload.config = {
   ...payload.config, // Preserve existing config properties
   urls: {
     payin_notify: payload.payin_notify,
     payout_notify: payload.payout_notify,
     return_url: payload.return_url,
     site: payload.site,
   },
   keys: {
     secret:Secret,
     public:Public,
   },
 };
  delete payload.payin_notify;
  delete payload.payout_notify;
  delete payload.return_url;
  delete payload.site;
  const { company_id, user_id, role, } = req.user;
  const { error } = VALIDATE_MERCHANT_SCHEMA.validate(payload);
  if (error) {
    throw new ValidationError(error);
  }
   payload.company_id = company_id;
   payload.created_by = user_id;
   payload.updated_by = user_id;
  // Call the service to create the Merchant
  await transactionWrapper(createMerchantService)(payload, role);

  // Log success message
  console.log('Merchant created successfully');

  // Send a success response to the client
  return sendSuccess(res, {}, 'Merchant created successfully');
};
const getMerchants = async (req, res) => {
  const { company_id, role, designation, user_id } = req.user;
  const {page, limit} = req.query;
  const data = await getMerchantsService(
    {
      company_id,
      ...req.query,
    },
    role, page,limit,
    designation,
    user_id
  );
  console.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantCodes = async (req, res) => {
  const {company_id} = req.user
  const data = await getMerchantsServiceCode(
    company_id
  );
  console.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};


const getMerchantsById = async (req, res) => {
  const { role } = req.user;
  if (!req.params) {
    throw new BadRequestError("id required in request");
  }
  const { id } = req.params;
  const { company_id } = req.user;
  // Fetch merchants data from the service
  const data = await getMerchantByIdService({ id, company_id }, role, true);
  // Log success message
  console.log('get Merchant successfully', data);

  // Send success response
  return sendSuccess(res, data, 'Merchant fetched successfully');
};

const updateMerchant = async (req, res) => {
 if (!req.params) {
   throw new BadRequestError('id required in request');
 }
  
  let payload = req.body;
      delete payload.payin_notify;
      delete payload.payout_notify;
      delete payload.return_url;

  console.log(payload, "payload data");
  if (payload.site) {
    payload["config=jsonb_set(config, '{urls,site}', $1::jsonb)"] = payload.site;
    delete payload.site;
  }
  // config = jsonb_set(config, '{urls,site}', '"new_value"');
  // payload.config = { ...payload.config, url: { ...payload.config?.url } };

  // const urlKeys = ['payin_notify', 'payout_notify', 'return_url', 'site'];
  // urlKeys.forEach((key) => {
  //   if (
  //     payload[key] !== undefined &&
  //     payload[key] !== payload.config.url[key]
  //   ) {
  //     payload.config.url[key] = payload[key];
  //     delete payload[key];
  //   }
  // });


  const { error: bodyError } =
    VALIDATE_UPDATE_MERCHANT_STATUS.validate(payload);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const { id } = req.params; 
  const { company_id, user_id, role } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to update the Merchant
  await updateMerchantService(ids, payload, role);
  // Log success message
  console.log('Merchant updated successfully');
  // Send a success response to the client
  return sendSuccess(res, {}, 'Merchant updated successfully');
};

const deleteMerchant = async (req, res) => {
  const { role } = req.user;
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params; // Assuming the Merchant ID is passed as a parameter
  // Call the service to delete the Merchant
  const { company_id, user_id } = req.user;
  const updated_by = user_id;
  const ids = { id, company_id };
  await deleteMerchantService(ids, updated_by, role);
  // Log success message
  console.log('Merchant deleted successfully');

  // Send a success response to the client
  return sendSuccess(res, {}, 'Merchant deleted successfully');
};

export {
  createMerchant,
  getMerchants,
  updateMerchant,
  deleteMerchant,
  getMerchantsById,
  getMerchantCodes
};
