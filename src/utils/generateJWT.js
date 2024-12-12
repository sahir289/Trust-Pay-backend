
import jwt from "jsonwebtoken"
import config from "../config/config";
const generateAccessToken = (payload) => {
    const token = jwt.sign(payload, config.accessTokenSecretKey, {
        // expiresIn: config.accessTokenExpireTime,
    });
    return token;
}

export {generateAccessToken};