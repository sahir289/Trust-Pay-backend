import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import { AuthenticationError} from '../utils/appErrors.js';
// import { verifyToken } from '../utils/auth.js';
// import { getLoginDao } from '../apis/auth/authDao.js';

const logoutSet = new Set();

const isAuthenticated = (req, res, next) => {
  const token = req.header(AUTH_HEADER_KEY);

  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  if (logoutSet.has(token)) {
    throw new AuthenticationError('Token expired or User logged out.');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.jwt_secret);
    
    // in future need to keep check with session_id if user is logged out or not
    // console.log(decoded, "decoddeeed")
    // const user = await getLoginDao(decoded.user_id, decoded.company_id);
    // if(!user){
    //   throw new NotFoundError('User Not Found');
    // }
    // console.log(user, "user here")
    // const sessionId = user?.config.session_id;
    // // console.log(sessionId, decoded.session_id, "decoded.session_id")
    // if(sessionId !== decoded.session_id){
    //   throw new AuthenticationError('Token expired or User logged in somewhere else.');
    // } else {
    // }
    req.user = decoded;
    next();
  } catch (error) {
    throw new AuthenticationError('Invalid token', error);
  }
};

const authorized = (req, res, next) => {
  const { designation_name } = req.user;
  if (!designation_name) {
    throw new AuthenticationError('User not authorized to perform this action');
  }
  next();
};

export { isAuthenticated, logoutSet, authorized };