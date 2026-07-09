import { getMerchantsKeysDao } from "../../apis/merchants/merchantDao.js";
import logger from "../logger.js";
import { getCachedData, setCachedData } from "../redishashkey.js";

export const MERCHANT_KEYS_CACHE_TTL_SEC = 60 * 60; // 1 hour

export const getMerchantKeysFromCacheOrDb = async (merchantId) => {
    try {
      if (!merchantId) {
        return null;
      }
  
      const cacheKey = `merchant:keys:${merchantId}`;
  
      const cachedKeys = await getCachedData(
        cacheKey,
        'Merchant keys cache',
      );
  
      if (cachedKeys) {
        console.log('Returning cached merchant keys for merchantId:', merchantId);
        return cachedKeys;
      }
  
      const merchantKeys = await getMerchantsKeysDao(merchantId);
  
      await setCachedData(
        cacheKey,
        merchantKeys,
        MERCHANT_KEYS_CACHE_TTL_SEC,
        'Merchant keys cache',
      );
  
      return merchantKeys;
    } catch (error) {
      logger.error('Error in getMerchantKeysFromCacheOrDb:', error);
      throw error;
    }
  };