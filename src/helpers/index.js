import axios from "axios";
import config from "../config/config.js";

// Function to calculate balances based on role
export const calculateBalances = (calc, prevCalc, isMerchant) => {
    const baseCalculation = calc.total_payin_amount - calc.total_payout_amount - (calc.total_payin_commission - calc.total_payout_commission + calc.total_reverse_payout_commission) - calc.total_chargeback_amount + calc.total_reverse_payout_amount;
    return {
        currentBalance: isMerchant ? baseCalculation - calc.total_settlement_amount : baseCalculation + calc.total_settlement_amount,
        netBalance: prevCalc.net_balance + baseCalculation + (isMerchant ? -calc.total_settlement_amount : calc.total_settlement_amount)
    };
};

export const calculateCommission = (amount, percentage) => {
    return (amount * percentage) / 100;
};


export const calculateDuration = (createdAt) => {
    const durMs = new Date() - createdAt;
    const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
    const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
    const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
    const duration = `${durHours}:${durMinutes}:${durSeconds}`;
    return duration;
}

export const getTelegramFilePath = async (fileId) => {
    if (!fileId) {
        console.log('No telegram photo file id found!');
        return;
    }

    if (!config.telegramOcrBotToken) {
        console.log('Telegram Bot Token not foun!');
        return;
    }

    const url = `https://api.telegram.org/bot${config.telegramOcrBotToken}/getFile?file_id=${fileId}`;
    const res = await axios.get(url);
    return res.data.result.file_path;
}

export const getTelegramImageBase64 = async (filePath) => {
    if (!filePath) {
        console.log('No telegram photo file path found!');
        return;
    }

    if (!config.telegramOcrBotToken) {
        console.log('Telegram Bot Token not foun!');
        return;
    }
    const url = `https://api.telegram.org/file/bot${config.telegramOcrBotToken}/${filePath}`;
    const res = await axios.get(url, {
        responseType: "arraybuffer",
    });

    return globalThis.Buffer.from(res.data, "binary").toString('base64');
}

export const getImageContentFromOCr = async (image) => {
    if (!image) {
        console.log('No image provided for OCR!');
        return;
    }

    const res = await axios.post("http://34.228.18.32:8000/ocr", {
        image
    });

    if (res.data.status === 'failure') {
        console.log('Unable to get content from image with ocr', res.data);
        return;
    }

    const data = res.data?.data || {};

    return {
        amount: data.amount?.replace(",", ""),
        utr: data.transaction_id,
        bankName: data.bank_name,
        timeStamp: data.timestamp,
    }

}

// Helper function to convert a readable stream to a buffer
export const streamToBase64 = (readableStream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (chunk) => chunks.push(chunk));
        readableStream.on('end', () => {
            const buffer = globalThis.Buffer.concat(chunks);
            const base64 = buffer.toString('base64');
            resolve(base64);
        });
        readableStream.on('error', reject);
    });
};

export const filterResponse = async (data, key) => {
    if (typeof data === 'object' && data !== null && key in data) {
      return { [key]: data[key] };
    }
    return {};
  }