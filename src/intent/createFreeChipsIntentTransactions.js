import axios from 'axios';
import crypto from 'crypto'; 
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';

/**
 * Freechips ke liye payment transaction create karne ka function.
 * @param {string} providerKey - Config se key (e.g., "freechips")
 * @param {Object} deposit - Deposit object jisme payin details hain
 * @param {number|string} amount - Transaction amount
 */
export const createFreechipsTransaction = async (
  providerKey,
  deposit,
  amount
) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    }
    
    console.log('Creating Freechips transaction with deposit:', deposit, 'and amount:', amount);
    console.log('Provider config:', providerConfig);
    
    const [company] = await getCompanyByIDDao({ id: deposit.company_id });
    const secretKey = company?.config?.FREECHIPS?.secretKey;
    const secretIv = company?.config?.FREECHIPS?.secretIv;
    const secretCode = company?.config?.FREECHIPS?.secretCode;
    const merchantKey = company?.config?.FREECHIPS?.merchantKey;
    const { payin_url } = providerConfig;
    
    const finalAmount = parseFloat(deposit.amount || amount).toString();
    const orderId = deposit.merchant_order_id;
    const userId = deposit.user;
    
    if (!secretKey || !secretIv || !secretCode || !merchantKey || !orderId || !finalAmount) {
      throw new Error('Missing required credentials or transaction data');
    }

    // 1. Prepare Query Data
    const queryData = {
      "merchant_key": merchantKey,
      "payee_name": userId || 'Customer',
      "amount": finalAmount,
      "order_id": orderId
    };

    const paddedKey = Buffer.alloc(32);
    Buffer.from(secretKey).copy(paddedKey);
    const ivBuffer = Buffer.from(secretIv);

    // 3. Data Encryption
    const cipher = crypto.createCipheriv('aes-256-cbc', paddedKey, ivBuffer);
    let encryptedData = cipher.update(JSON.stringify(queryData), 'utf8', 'base64');
    encryptedData += cipher.final('base64');

    const requestBody = {
      data: encryptedData,
      secretCode: secretCode
    };
    
    console.log('Request body for Freechips transaction:', requestBody);
    console.log('Freechips payin URL:', payin_url);

    if (!payin_url) {
      throw new Error('Missing Freechips payin URL in config');
    }
    
    // 4. API Request
    const endpoint = payin_url;
    const response = await axios.post(endpoint, requestBody, {
      headers: { 
        'Content-Type': 'application/json',
      },
    });

    logger.info(`${providerKey} transaction created raw response:`, {
      response: response.data,
    });

    // 5. Response Handling & Decryption
    if (response.data) {
      // Freechips standard success check format ya 'true' string response
      const isSuccess = response.data['error/success'] === 'true' || response.data.error === false;

      if (isSuccess && response.data.data) {
        // Success Decryption Logic
        const decipher = crypto.createDecipheriv('aes-256-cbc', paddedKey, ivBuffer);
        let decryptedStr = decipher.update(response.data.data, 'base64', 'utf8');
        decryptedStr += decipher.final('utf8');

        const decryptedResponse = JSON.parse(decryptedStr);
        logger.info(`${providerKey} transaction decrypted data:`, decryptedResponse);
        console.log('Decrypted Response:', decryptedResponse);
        
        return decryptedResponse;
      } 
      // Agar API ne error: true diya hai par encrypted data bheja hai
      else if (response.data.error === true && response.data.data) {
        try {
          const decipher = crypto.createDecipheriv('aes-256-cbc', paddedKey, ivBuffer);
          let decryptedErrorStr = decipher.update(response.data.data, 'base64', 'utf8');
          decryptedErrorStr += decipher.final('utf8');
          
          console.error('Decrypted API Error Details:', decryptedErrorStr);
          throw new Error(`API Error: ${decryptedErrorStr}`);
        } catch (decryptError) {
          throw new Error(response.data?.message|| decryptError || 'API responded with error status (Failed to decrypt error message)');
        }
      } else {
        throw new Error(response.data?.message || 'API responded with unexpected error format');
      }
    } else {
      throw new Error('Empty response received from API');
    }

  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};