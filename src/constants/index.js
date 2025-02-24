
export const Status = {
    ASSIGNED: 'ASSIGNED',
    SUCCESS: 'SUCCESS',
    DROPPED: 'DROPPED',
    DUPLICATE: 'DUPLICATE',
    INITIATED: 'INITIATED',
    DISPUTE: 'DISPUTE',
    REVERSED: 'REVERSED',
    IMG_PENDING: 'IMG_PENDING',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    TEST_SUCCESS: 'TEST_SUCCESS',
    TEST_DROPPED: 'TEST_DROPPED',
    BANK_MISMATCH: 'BANK_MISMATCH',
    FAILED: 'FAILED',
    USER_DROPPED: 'USER_DROPPED'
}

export const Currency = {
    INR: 'INR',
}

export const Method = {
    BANK: 'BANK',
    CASH: 'CASH',
    AED: 'AED',
    CRYPTO: 'CRYPTO',
    EKO: 'EKO',
}

export const Type = {
    PAYIN: 'PAYIN',
    PAYOUT: 'PAYOUT',
}

export const Role = {
    ADMIN: 'ADMIN',
    TRANSACTIONS: 'TRANSACTIONS',
    OPERATIONS: 'OPERATIONS',
    MERCHANT_ADMIN: 'MERCHANT_ADMIN',
    MERCHANT: 'MERCHANT',
    SUB_MERCHANT: 'SUB_MERCHANT',
    MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS',
    VENDOR: 'VENDOR',
    VENDOR_OPERATIONS: 'VENDOR_OPERATIONS',
}

export const columns = {
    MERCHANT: ['id', 'role_id', 'user_id', 'first_name', 'last_name', 'code', 'min_payin', 'max_payin', 'payin_commission', 'min_payout', 'max_payout', 'payout_commission', 'is_test_mode', 'is_enabled', 'dispute_enabled', 'is_demo', 'balance', 'company_id', 'config', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    USER: ['id', 'role_id', 'company_id', 'designation_id', 'first_name', 'last_name', 'email', 'contact_no', 'user_name', 'password', 'code', 'is_enabled', 'last_login', 'last_logout', 'config', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    ROLE: ['id', 'role', 'company_id', 'email', 'contact_no', 'created_at', 'updated_at', 'is_obsolete'],
    COMPANY: ['id', 'first_name', 'last_name', 'email', 'contact_no', 'config', 'is_obsolete'],
    SETTLEMENT: ['id', 'sno', 'user_id', 'status', 'amount', 'method', 'config', 'approved_at', 'rejected_at', 'created_by', 'updated_by', 'created_at', 'updated_at', 'company_id', 'is_obsolete'],      
    CALCULATION: ['id', 'user_id', 'total_payin_count', 'total_payin_amount', 'total_payin_commission', 'total_payout_count', 'total_payout_amount', 'total_payout_commission', 'total_settlement_count', 'total_settlement_amount', 'total_chargeback_count', 'total_chargeback_amount', 'current_balance', 'net_balance', 'created_at', 'updated_at', 'company_id', 'is_obsolete'],
    COMPLAINTS: ['id', 'sno', 'status', 'payin_id', 'email', 'config', 'created_at', 'updated_at', 'company_id'],
    DESIGNATION: ['id', 'designation', 'role_id', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    PAYIN: ['id', 'sno', 'upi_short_code', 'qr_params', 'amount', 'status', 'is_notified', 'user_submitted_utr', 'currency', 'merchant_order_id', 'user', 'bank_acc_id', 'merchant_id', 'bank_response_id', 'payin_merchant_commission', 'payin_vendor_commission', 'user_submitted_image', 'duration', 'is_url_expires', 'expiration_date', 'one_time_used', 'approved_at', 'failed_at', 'config', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    PAYOUT: ['id', 'sno', 'user', 'merchant_id', 'bank_acc_id', 'amount', 'status', 'failed_reason', 'currency', 'merchant_order_id', 'acc_no', 'acc_holder_name', 'ifsc_code', 'bank_name', 'upi_id', 'utr_id', 'rejected_reason', 'payout_merchant_commission', 'payout_vendor_commission', 'from_bank_acc_id', 'approved_at', 'rejected_at', 'config', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    BANK_ACCOUNT: ['id', 'sno', 'user_id', 'upi_id', 'upi_params', 'name', 'acc_no', 'ifsc', 'bank_name', 'is_qr', 'is_bank', 'is_enabled', 'payin_count', 'balance', 'today_balance', 'bank_used_for', 'config', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    VENDOR: ['id', 'role_id', 'user_id', 'first_name', 'last_name', 'code', 'payin_commission', 'payout_commission', 'balance', 'created_by', 'updated_by', 'config', 'company_id', 'created_at', 'updated_at', 'is_obsolete'],
    CHARGE_BACK: ['id', 'sno', 'user', 'merchant_user_id', 'vendor_user_id', 'payin_id', 'bank_acc_id', 'amount', 'when', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    USER_HIERARCHY: ['id', 'user_id', 'role_id', 'config', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'is_obsolete'],
    CHECK_UTR_HISTORY: ['id', 'sno', 'payin_id', 'utr', 'created_by', 'updated_by', 'created_at', 'updated_at', 'company_id', 'is_obsolete', 'config'],
    RESET_DATA_HISTORY: ['id', 'sno', 'payin_id', 'pre_status', 'created_by',  'updated_by', 'created_at', 'updated_at', 'company_id', 'is_obsolete', 'config'],
    BANK_RESPONSE: ['id', 'sno','status', 'bank_id', 'amount', 'upi_short_code', 'utr', 'is_used', 'created_at', 'updated_at', 'created_by', 'company_id', 'is_obsolete', 'config' , 'updated_by']

}
export const merchantColumns = {
    MERCHANT: ['first_name', 'last_name', 'code', 'min_payin', 'max_payin', 'payin_commission', 'min_payout', 'max_payout', 'payout_commission', 'balance', 'config'],
    USER: ['first_name', 'last_name', 'email', 'contact_no', 'user_name', 'code', 'config'],
    SETTLEMENT: ['sno', 'status', 'amount', 'method', 'config',],      
    CALCULATION: ['total_payin_count', 'total_payin_amount', 'total_payin_commission', 'total_payout_count', 'total_payout_amount', 'total_payout_commission', 'total_settlement_count', 'total_settlement_amount', 'total_chargeback_count', 'total_chargeback_amount', 'current_balance', 'net_balance'],
    COMPLAINTS: ['sno', 'status', 'email', 'config'],
    PAYIN: ['id', 'sno','qr_params', 'amount', 'status', 'is_notified', 'user_submitted_utr', 'currency', 'merchant_order_id', 'user', 'payin_merchant_commission', 'user_submitted_image', 'duration', 'config'],
    PAYOUT: ['id', 'sno', 'user', 'amount', 'status', 'failed_reason', 'currency', 'merchant_order_id', 'acc_no', 'acc_holder_name', 'ifsc_code', 'bank_name', 'upi_id', 'utr_id', 'rejected_reason', 'payout_merchant_commission', 'config'],
    CHAREBACK: ['sno', 'user', 'merchant_user_id', 'amount', 'when'],
    USER_HIERARCHY: ['config'],

}
export const vendorColumns = {
    USER: ['first_name', 'last_name', 'email', 'contact_no', 'user_name', 'code', 'config'],
    SETTLEMENT: ['sno', 'status', 'amount', 'method', 'config',],      
    CALCULATION: ['total_payin_count', 'total_payin_amount', 'total_payin_commission', 'total_payout_count', 'total_payout_amount', 'total_payout_commission', 'total_settlement_count', 'total_settlement_amount', 'total_chargeback_count', 'total_chargeback_amount', 'current_balance', 'net_balance'],
    COMPLAINTS: ['sno', 'status', 'email', 'config'],
    PAYIN: ['id', 'sno','qr_params', 'amount', 'status', 'user_submitted_utr', 'currency', 'user', 'payin_vendor_commission', 'user_submitted_image', 'duration', 'config'],
    PAYOUT: ['id', 'sno', 'user', 'amount', 'status', 'failed_reason', 'currency', 'acc_no', 'acc_holder_name', 'ifsc_code', 'bank_name', 'upi_id', 'utr_id', 'rejected_reason', 'payout_vendor_commission', 'from_bank_acc_id', 'config'],
    BANK_ACCOUNT: ['sno', 'upi_id', 'upi_params', 'name', 'acc_no', 'acc_name', 'ifsc_code', 'bank_name', 'is_qr', 'is_bank', 'is_enabled', 'payin_count', 'balance', 'today_balance', 'bank_used_for', 'config'],
    VENDOR: ['first_name', 'last_name', 'code', 'payin_commission', 'payout_commission', 'balance', 'config'],
    CHAREBACK: ['sno', 'user', 'vendor_user_id', 'bank_acc_id', 'amount', 'when'],

}

export const tableName = {
    USER: 'User',
    MERCHANT: 'Merchant',
    ROLE: 'Role',
    COMPANY: 'Company',
    CALCULATION: 'Calculation',
    COMPLAINTS: 'Complaints',
    DESIGNATION: 'Designation',
    PAYIN: 'Payin',
    PAYOUT: 'Payout',
    VENDOR: 'Vendor',
    CHARGE_BACK: 'ChargeBack',
    BANK_ACCOUNT: 'BankAccount',
    USER_HIERARCHY: 'UserHierarchy',
    SETTLEMENT: 'Settlement',
    CHECK_UTR_HISTORY :'CheckUtrHistory',
    RESET_DATA_HISTORY : 'ResetDataHistory',
    BANK_RESPONSE: 'BankResponse'
}

export const BankTypes = {
    UPI: 'upi',
    PHONE_PE: 'phone_pe',
    BANK_TRANSFER: 'bank_transfer',
    INTENT: 'intent',
}

export const AccessRoles = {
    USER: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.VENDOR],
    MERCHANT: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.SUB_MERCHANT, Role.MERCHANT_OPERATIONS],
    VENDOR: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.VENDOR, Role.VENDOR_OPERATIONS],
    PAYIN: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.SUB_MERCHANT, Role.MERCHANT_OPERATIONS, Role.VENDOR, Role.VENDOR_OPERATIONS],
    PAYOUT: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.SUB_MERCHANT, Role.MERCHANT_OPERATIONS, Role.VENDOR, Role.VENDOR_OPERATIONS],
    SETTLEMENT: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.SUB_MERCHANT, Role.MERCHANT_OPERATIONS, Role.VENDOR, Role.VENDOR_OPERATIONS],
    REPORT: [Role.ADMIN, Role.TRANSACTIONS, Role.OPERATIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.SUB_MERCHANT, Role.MERCHANT_OPERATIONS, Role.VENDOR, Role.VENDOR_OPERATIONS],
    COMPANY: [Role.ADMIN],
    USER_HIERARCHY: {
        CREATE_DELETE: [Role.ADMIN, Role.TRANSACTIONS],
        UPDATE_READ: [Role.ADMIN, Role.TRANSACTIONS, Role.MERCHANT_ADMIN]
    },
    RESET_DATA_HISTORY: [Role.ADMIN],
    CHECK_UTR_HISTORY: [Role.ADMIN],
    BANK_RESPONSE: [Role.ADMIN],
    BANK_ACCOUNT: [Role.ADMIN, Role.OPERATIONS, Role.TRANSACTIONS, Role.VENDOR, Role.VENDOR_OPERATIONS],
    CHARGE_BACK: {
        CREATE_DELETE: [Role.ADMIN, Role.TRANSACTIONS],
        UPDATE_READ: [Role.ADMIN, Role.TRANSACTIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.VENDOR]
    },
    CALCULATION: [Role.ADMIN, Role.TRANSACTIONS, Role.MERCHANT_ADMIN, Role.MERCHANT, Role.VENDOR],
    ROLES : [Role.ADMIN, Role.TRANSACTIONS],
    DESIGNATION : [Role.ADMIN, Role.TRANSACTIONS],
    COMPLAINTS:[Role.ADMIN]

}