import { Client } from '@elastic/elasticsearch';
import config from '../config/config.js';
import { logger } from './logger.js';

const ES_CONFIG = {
  node: config.elasticSearch.node,
  // auth: {  // uncomment if enabling security later
  //   username: config.elasticSearch.username,
  //   password: config.elasticSearch.password,
  // },
  indexPrefix: config.elasticSearch.indexPrefix,
  requestTimeout: config.elasticSearch.requestTimeout,
  maxRetries: config.elasticSearch.maxRetries,
  keepAlive: true 
};

let esClient = null;

const createESClient = async () => {
  if (!esClient) {
    try {
      esClient = new Client(ES_CONFIG);
      await esClient.ping();
      logger.info('Elasticsearch client connected successfully');
      return esClient;
    } catch (error) {
      logger.error('Failed to connect to Elasticsearch:', error);
      throw new Error(`Elasticsearch connection failed: ${error.message}. Check node URL and ensure Elasticsearch is running.`);
    }
  }
  return esClient;
};
// password =  qWvqjPBl+eoqsMg8Ge4j;


export default async () => {
  try {
    return await createESClient();
  } catch (error) {
    logger.error('Error in getting Elasticsearch client:', error);
    throw error;
  }
};