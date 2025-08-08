import {
    getPayInUrlService,
    updateCalculationTable,
    processPayInService,
} from './payInService.js';
import { getBankResponseDao, updateBotResponseDao } from '../bankResponse/bankResponseDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { updatePayInUrlDao, getPayInUrlDao, getPayInUrlsDao } from './payInDao.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { merchantPayinCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { sendDisputeMessageTelegramBot, sendBankMismatchMessageTelegramBot } from '../../utils/sendTelegramMessages.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';

const mockPayload = {
    userSubmittedUtr: 'UTR123',
    merchantOrderId: 'ORDER123',
    amount: 1000,
    from_telegram: false,
    telegramMessage: { chat: { id: 'CHAT123' }, message_id: 'MSG123' },
    telegramBotToken: 'BOT_TOKEN',
    user_submitted_image: 'image.jpg',
};
const mockUpdatedBy = 'user123';
const mockPayIn = {
    id: 'PAYIN123',
    bank_acc_id: 'BANK123',
    company_id: 'COMPANY123',
    merchant_order_id: 'ORDER123',
    status: 'PENDING',
    one_time_used: false,
    is_url_expires: false,
    created_at: new Date(),
    config: { urls: { notify: 'http://notify.url', return: 'http://return.url' } },
    merchant_id: 'MERCHANT123',
    amount: 1000,
};
const mockBank = {
    id: 'BANK123',
    nick_name: 'Bank1',
    user_id: 'USER123',
    company_id: 'COMPANY123',
};
const mockBankResponse = {
    id: 'BANK_RESP123',
    utr: 'UTR123',
    amount: 1000,
    bank_id: 'BANK123',
    is_used: false,
};
const mockMerchant = {
    id: 'MERCHANT123',
    user_id: 'MERCHANT_USER123',
    payin_commission: 2,
};

jest.mock('./payInService.js', () => ({
    verifyPayinsService: jest.fn(),
    assignedBankToPayInUrlService: jest.fn(),
    getPayInUrlService: jest.fn(),
    updateCalculationTable: jest.fn(),
    processPayInService: jest.requireActual('./payInService.js').processPayInService,
}));

jest.mock('../../utils/sendTelegramMessages.js', () => ({
    sendBankMismatchMessageTelegramBot: jest.fn(),
    sendDisputeMessageTelegramBot: jest.fn(),
}));



jest.mock('../../utils/advisoryLock.js', () => ({
    checkLockEdit: jest.fn(),
}));

jest.mock('../../callBacksAndWebHook/merchantCallBacks.js', () => ({
    merchantPayinCallback: jest.fn(),
}));

jest.mock('../bankResponse/bankResponseDao.js', () => ({
    getBankResponseDao: jest.fn(),
    updateBotResponseDao: jest.fn(),
}));

jest.mock('../vendors/vendorDao.js', () => ({
    getVendorsDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
    getMerchantsDao: jest.fn(),
}));

jest.mock('./payInDao.js', () => ({
    updatePayInUrlDao: jest.fn(),
    getPayInUrlDao: jest.fn(),
    getPayInUrlsDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
    getMerchantBankDao: jest.fn(),
    getBankaccountDao: jest.fn(),
}));

jest.mock('../../utils/calculation.js', () => ({
    calculateCommission: jest.fn(),
}));

jest.mock('../calculation/calculationDao.js', () => ({
    getCalculationforCronDao: jest.fn(),
    updateCalculationBalanceDao: jest.fn(),
}));

describe('processPayInService', () => {
    let mockConn;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConn = {
            query: jest.fn().mockImplementation(async (query, params) => {
                if (query.includes('pg_try_advisory_xact_lock')) {
                    return { rows: [{ acquired: true }] };
                }
                return { rows: [] };
            }),
        };
        getPayInUrlService.mockResolvedValue(mockPayIn);
        getPayInUrlDao.mockResolvedValue(mockPayIn);
        checkLockEdit.mockResolvedValue(true);
        getBankaccountDao.mockResolvedValue([mockBank]);
        getPayInUrlsDao.mockResolvedValue([]);
        getBankResponseDao.mockResolvedValue(mockBankResponse);
        updateBotResponseDao.mockResolvedValue();
        getMerchantsDao.mockResolvedValue([mockMerchant]);
        calculateCommission.mockReturnValue(20);
        updateCalculationTable.mockResolvedValue();
        updatePayInUrlDao.mockResolvedValue();
        getVendorsDao.mockResolvedValue([
            {
                user_id: mockBank.user_id,
                payin_commission: 1.5,
            },
        ]);
        getCalculationforCronDao.mockResolvedValue([
            {
                user_id: mockMerchant.user_id,
                balance: 0,
                payin_commission: 20,
            },
        ]);
    });

    test('should handle successful payin', async () => {
        const result = await processPayInService(mockConn, mockPayload, mockUpdatedBy);

        expect(getPayInUrlService).toHaveBeenCalledWith('ORDER123', mockConn, true);

        expect(checkLockEdit).toHaveBeenCalledWith(mockConn, 'BANK123UTR123', true);
        expect(getBankaccountDao).toHaveBeenCalledWith({
            id: mockPayIn.bank_acc_id,
            company_id: mockPayIn.company_id,
        });
        expect(getPayInUrlsDao).toHaveBeenCalledWith({ user_submitted_utr: 'UTR123' });
        expect(updateBotResponseDao).toHaveBeenCalledWith('BANK_RESP123', { is_used: true }, mockConn);
        expect(getMerchantsDao).toHaveBeenCalledWith({ id: mockPayIn.merchant_id });
        expect(getVendorsDao).toHaveBeenCalledWith({ user_id: mockBank.user_id });
        expect(getCalculationforCronDao).toHaveBeenCalledWith(
            { user_id: mockMerchant.user_id },
            mockConn
        );
        expect(updatePayInUrlDao).toHaveBeenCalledWith(
            mockPayIn.id,
            expect.objectContaining({
                status: 'SUCCESS',
                amount: 1000,
                user_submitted_utr: 'UTR123',
                is_url_expires: true,
                one_time_used: true,
                user_submitted_image: 'image.jpg',
                is_notified: true,
                updated_by: mockUpdatedBy,
                bank_response_id: 'BANK_RESP123',
                payin_merchant_commission: 20,
                payin_vendor_commission: expect.any(Number),
            }),
            mockConn
        );
        expect(merchantPayinCallback).toHaveBeenCalledWith(
            mockPayIn.config.urls.notify,
            expect.objectContaining({
                status: 'SUCCESS',
                merchantOrderId: 'ORDER123',
                payinId: 'PAYIN123',
                amount: 1000,
                req_amount: 1000,
                utr_id: 'UTR123',
            })
        );
        expect(result).toEqual(expect.objectContaining({
            status: 'SUCCESS',
            merchantOrderId: 'ORDER123',
            payinId: 'PAYIN123',
            amount: 1000,
            req_amount: 1000,
            utr_id: 'UTR123',
        }));
    });

    test('should handle expired or used payin url', async () => {
        const expiredPayIn = {
            ...mockPayIn,
            one_time_used: true,
            is_url_expires: false,
            config: { urls: { return: 'http://return.url' } },
        };
        getPayInUrlService.mockResolvedValue(expiredPayIn);
        getPayInUrlDao.mockResolvedValue(expiredPayIn); 

        const result = await processPayInService(mockConn, mockPayload, mockUpdatedBy);

        expect(getPayInUrlService).toHaveBeenCalledWith('ORDER123', mockConn, true);
        expect(result).toEqual({
            error: 'Url is expired',
            result: { redirect_url: expiredPayIn.config.urls.return },
        });
        expect(checkLockEdit).not.toHaveBeenCalled();
    });

    test('should handle duplicate payin', async () => {
        getPayInUrlsDao.mockResolvedValue([mockPayIn]);
        updatePayInUrlDao.mockResolvedValue();

        const result = await processPayInService(mockConn, mockPayload, mockUpdatedBy);

        expect(updatePayInUrlDao).toHaveBeenCalledWith(
            mockPayIn.id,
            expect.objectContaining({ status: 'DUPLICATE' }),
            mockConn
        );
        expect(merchantPayinCallback).toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining(
            {
                "amount": 1000,
                "merchantOrderId": "ORDER123",
                "message": "Duplicate entry found!",
                "payinId": "PAYIN123",
                "req_amount": 1000,
                "status": "DUPLICATE",
                "utr_id": "UTR123",
            }
        ));
    });

    test('should handle bank mismatch with telegram', async () => {
        const mismatchedBankResponse = { ...mockBankResponse, bank_id: 'BANK456' };
        const botBank = { ...mockBank, id: 'BANK456', nick_name: 'Bank2' };
        getBankaccountDao
            .mockResolvedValueOnce([mockBank])
            .mockResolvedValueOnce([botBank]);
        getBankResponseDao.mockResolvedValue(mismatchedBankResponse);
        updateBotResponseDao.mockResolvedValue();
        updatePayInUrlDao.mockResolvedValue();
        sendBankMismatchMessageTelegramBot.mockResolvedValue();

        const telegramPayload = { ...mockPayload, from_telegram: true };
        const result = await processPayInService(mockConn, telegramPayload, mockUpdatedBy);

        expect(updatePayInUrlDao).toHaveBeenCalledWith(
            mockPayIn.id,
            expect.objectContaining({ status: 'BANK_MISMATCH' }),
            mockConn
        );
        expect(sendBankMismatchMessageTelegramBot).toHaveBeenCalledWith(
            telegramPayload.telegramMessage.chat.id,
            mockBank.nick_name,
            botBank.nick_name,
            telegramPayload.telegramBotToken,
            telegramPayload.telegramMessage.message_id
        );
        expect(result).toBe(true);
    });

    test('should handle dispute with telegram', async () => {
        const disputeBankResponse = { ...mockBankResponse, amount: 500 };
        getBankResponseDao.mockResolvedValue(disputeBankResponse);
        updateBotResponseDao.mockResolvedValue();
        updatePayInUrlDao.mockResolvedValue();
        sendDisputeMessageTelegramBot.mockResolvedValue();

        const telegramPayload = { ...mockPayload, from_telegram: true };
        const result = await processPayInService(mockConn, telegramPayload, mockUpdatedBy);

        expect(updatePayInUrlDao).toHaveBeenCalledWith(
            mockPayIn.id,
            expect.objectContaining({ status: 'DISPUTE' }),
            mockConn
        );
        expect(sendDisputeMessageTelegramBot).toHaveBeenCalledWith(
            telegramPayload.telegramMessage.chat.id,
            mockPayload.amount,
            disputeBankResponse.amount,
            telegramPayload.telegramBotToken,
            telegramPayload.telegramMessage.message_id
        );
        expect(result).toBe(true);
    });

    test('should throw NotFoundError when bank not found', async () => {
        getBankaccountDao.mockResolvedValue([]);

        await expect(
            processPayInService(mockConn, mockPayload, mockUpdatedBy)
        ).rejects.toThrow(NotFoundError);
    });

    test('should throw BadRequestError for missing telegram parameters', async () => {
        const invalidPayload = { ...mockPayload, from_telegram: true, telegramBotToken: null };
        await expect(
            processPayInService(mockConn, invalidPayload, mockUpdatedBy)
        ).rejects.toThrow(BadRequestError);
    });
});