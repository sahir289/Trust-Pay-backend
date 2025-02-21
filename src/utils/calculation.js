
import jwt from "jsonwebtoken"
import config from "../config/config";
export const generateAccessToken = (payload) => {
    const token = jwt.sign(payload, config.accessTokenSecretKey, {
        // expiresIn: config.accessTokenExpireTime,
    });
    return token;
}

export const getAmountFromPerc = (perc, amount)=>{
    return (amount/100) * perc;
}

export const calculateCommission = (amount, percentage) => {
    return (amount * percentage) / 100;
  };
