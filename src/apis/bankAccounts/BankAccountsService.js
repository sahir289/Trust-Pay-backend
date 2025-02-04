import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { getBankDao,getBankByIdDao } from './BankAccountsDao.js';
import { createBankDao } from './BankAccountsDao.js';
import { updateBankDao, deleteBankDao } from './BankAccountsDao.js';
const logger =new Logger();

export const createBankService= async (payload) => {
    let conn;
    try {
      conn = await getConnection();
      const data = await createBankDao(conn, payload);
      logger.log('Create bank successfully', 'info');
      return data;
    } catch (error) {
      logger.log('error getting while Creating bank in Bankservices', 'error', error);
      throw new BadRequestError('Error getting while Creating bank');
    } finally{
      if (conn) {
          try {
            conn.release();
          } catch (releaseError) {
            logger.log('Error while releasing the connection', 'error', releaseError);
          }
        }
    }
  };


  export const getBankByIdService = async (id) => {  
    let conn;
    try {
        conn = await getConnection();
        const data = await getBankByIdDao(conn, id);
        logger.log('Fetched Bank successfully', 'info');
        return data;
    } catch (error) {
        logger.log('Error while getting bank', 'error', error);
        throw new BadRequestError('Error while getting bank');
    } finally {
        if (conn) {
            try {
                conn.release();
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

  export const getBankService = async () => {
    let conn;
    try {
        conn = await getConnection();
        const data = await getBankDao(conn);  
        logger.log('Fetched banks successfully', 'info');
        return data;
    } catch (error) {
        logger.log('Error getting banks', 'error', error);
        throw new BadRequestError('Error while getting banks');
    } finally {
        if (conn) {
            try {
                conn.release();
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};



  export const updateBankService = async(payload , id)=>{
    let conn;
    try{
        conn = await getConnection();
        const data = await updateBankDao(conn, payload ,id);
        logger.log('Fetched Merchants successfully', 'info');
        return data;
    }
    catch (error) {
        logger.log('error getting while getting banks', 'error', error);
        throw new BadRequestError('Error getting while getting banks');
      } 
      finally{
        if (conn) {
            try {
              conn.release();
            } catch (releaseError) {
              logger.log('Error while releasing the connection', 'error', releaseError);
            }
          }
      }
  }



  export const deleteBankService = async(id)=>{
    console.log(id);
    let conn;
    try{
        conn = await getConnection();
        const data = await deleteBankDao(conn,id);
        logger.log('Fetched Merchants successfully', 'info');
        return data;
    }
    catch (error) {
        logger.log('error getting while getting banks', 'error', error);
        throw new BadRequestError('Error getting while getting banks');
      } 
      finally{
        if (conn) {
            try {
              conn.release();
            } catch (releaseError) {
              logger.log('Error while releasing the connection', 'error', releaseError);
            }
          }
      }
  }