import axios from "axios";
import {sendNewSuccess} from "../utils/responseHandlers.js";
export const getWalletBalance = async (req, res) => {
  try {
    const response = await axios.get(
      process.env.WALLET_BALANCE_URL,
      {
        headers: {
          "x-api-key": process.env.X_API_KEY,
          code: process.env.CODE,
        },
      }
    );
   const data = response.data.data; 
   const successMsg = response.data.message || "Wallet balance fetched successfully";
    return sendNewSuccess(res, data, successMsg);
  } catch (error) {
    console.error(
      "Wallet Balance Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};
