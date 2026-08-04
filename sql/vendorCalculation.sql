/* ============================================================
   CALCULATION BACKFILL SCRIPT
   Covers:
   - VENDOR
   - VENDOR_ADMIN / MEDIATOR
   - payin
   - payout
   - reverse payout
   - settlement (approved_at = +1 / updated_at(reversed) = -1)
   - chargeback
   - adjustment
   - rolling net_balance = previous net_balance + current_balance + adjustment_effect

   FORMULAS:
   current_balance = +payin - payout - payin_commission - payout_commission 
                     + rev_payout + rev_payout_commission - chargeback 
                     + (+sent_settlement - rev_settlement + internal_settlement)
   
   net_balance = previous_net_balance + current_balance + adjustment_effect
   adjustment_effect:
     - Positive adj (+500): -500 + commission
     - Negative adj (-250): +250 - commission
     Formula: -adjustment_amount + SIGN(adjustment_amount) * commission

   NOTE: The opening/seed net_balance (day before from_date) is fetched 
         directly from the database WITHOUT any formula applied.

   SAFE USAGE:
   1) Run first with run_mode = 'PREVIEW'
   2) Verify output
   3) Change run_mode = 'UPDATE'
   ============================================================ */

WITH RECURSIVE

input_params AS (
  SELECT
    $1::text AS run_mode,
    $2::varchar AS user_id,
    $3::varchar AS company_id,
    $4::date AS from_date,
    $5::date AS to_date
),

date_range AS (
  SELECT from_date AS target_date
  FROM input_params

  UNION ALL

  SELECT (target_date + INTERVAL '1 day')::date
  FROM date_range, input_params
  WHERE target_date < input_params.to_date
),

params AS (
  SELECT
    i.user_id,
    i.company_id,
    i.run_mode,
    d.target_date
  FROM input_params i
  CROSS JOIN date_range d
),

root_user AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,
    uh.config AS hierarchy_config
  FROM params p
  LEFT JOIN "UserHierarchy" uh
    ON uh.user_id = p.user_id
   AND COALESCE(uh.is_obsolete, false) = false
),

scope_users AS (
  SELECT
    ru.user_id,
    ru.company_id,
    ru.target_date,
    ru.user_id AS scoped_user_id,
    'SELF'::text AS relation
  FROM root_user ru

  UNION ALL

  SELECT
    ru.user_id,
    ru.company_id,
    ru.target_date,
    jsonb_array_elements_text(
      COALESCE(ru.hierarchy_config::jsonb -> 'siblings' -> 'sub_vendors', '[]'::jsonb)
    )::varchar AS scoped_user_id,
    'CHILD'::text AS relation
  FROM root_user ru
),

vendor_scope AS (
  SELECT
    su.user_id,
    su.company_id,
    su.target_date,
    su.scoped_user_id,
    su.relation,
    v.id AS vendor_id,
    v.user_id AS vendor_user_id,
    COALESCE(v.payin_commission, 0)::numeric AS payin_commission,
    COALESCE(v.payout_commission, 0)::numeric AS payout_commission,
    COALESCE(NULLIF(v.config ->> 'mediator_payin_commission', '')::numeric, 0) AS mediator_payin_commission,
    COALESCE(NULLIF(v.config ->> 'mediator_payout_commission', '')::numeric, 0) AS mediator_payout_commission,
    COALESCE(NULLIF(v.config ->> 'is_owned', '')::boolean, false) AS is_owned
  FROM scope_users su
  JOIN "Vendor" v
    ON v.user_id = su.scoped_user_id
   AND COALESCE(v.is_obsolete, false) = false
),

eligible_scope AS (
  SELECT *
  FROM vendor_scope
  WHERE relation = 'SELF'
     OR (relation = 'CHILD' AND is_owned = false)
),

/* =========================
   PAYIN
   ========================= */
payin AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,

    COALESCE(COUNT(br.id), 0)::int AS total_payin_records,
    COALESCE(SUM(CASE WHEN es.relation = 'SELF' THEN br.amount ELSE 0 END), 0)::numeric AS total_payin_amount,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'SELF' THEN br.amount * es.payin_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS vendor_payin_commission,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'CHILD' THEN br.amount * es.mediator_payin_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS mediator_payin_commission

  FROM params p
  LEFT JOIN eligible_scope es
    ON es.user_id = p.user_id
   AND es.company_id = p.company_id
   AND es.target_date = p.target_date
  LEFT JOIN "BankAccount" ba
    ON ba.user_id = es.vendor_user_id
   AND COALESCE(ba.is_obsolete, false) = false
  LEFT JOIN "BankResponse" br
    ON br.bank_id = ba.id
   AND br.company_id = p.company_id
   AND COALESCE(br.is_obsolete, false) = false
   AND br.status IN ('/success', '/internalTransfer')
   AND br.created_at::date = p.target_date
  GROUP BY p.user_id, p.company_id, p.target_date
),

/* =========================
   ADJUSTMENT
   ========================= */
adjustment AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,

    COALESCE(COUNT(br.id) FILTER (
      WHERE br.config ->> 'previousAmount' IS NOT NULL
    ), 0)::int AS total_adjustment_records,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'SELF'
         AND br.config ->> 'previousAmount' IS NOT NULL
        THEN br.amount::numeric - COALESCE(NULLIF(br.config ->> 'previousAmount', '')::numeric, 0)
        ELSE 0
      END
    ), 0)::numeric AS total_adjustment_amount,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'SELF'
         AND br.config ->> 'previousAmount' IS NOT NULL
        THEN ABS(
          br.amount::numeric - COALESCE(NULLIF(br.config ->> 'previousAmount', '')::numeric, 0)
        ) * es.payin_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS vendor_adjustment_commission,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'CHILD'
         AND br.config ->> 'previousAmount' IS NOT NULL
        THEN ABS(
          br.amount::numeric - COALESCE(NULLIF(br.config ->> 'previousAmount', '')::numeric, 0)
        ) * es.mediator_payin_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS mediator_adjustment_commission

  FROM params p
  LEFT JOIN eligible_scope es
    ON es.user_id = p.user_id
   AND es.company_id = p.company_id
   AND es.target_date = p.target_date
  LEFT JOIN "BankAccount" ba
    ON ba.user_id = es.vendor_user_id
   AND COALESCE(ba.is_obsolete, false) = false
  LEFT JOIN "BankResponse" br
    ON br.bank_id = ba.id
   AND br.company_id = p.company_id
   AND COALESCE(br.is_obsolete, false) = false
   AND br.status = '/success'
   AND br.updated_at::date = p.target_date
   AND br.created_at::date < p.target_date
   AND br.config ->> 'previousAmount' IS NOT NULL
  GROUP BY p.user_id, p.company_id, p.target_date
),

/* =========================
   PAYOUT
   ========================= */
payout AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,

    COALESCE(COUNT(po.id), 0)::int AS total_payout_records,
    COALESCE(SUM(CASE WHEN es.relation = 'SELF' THEN po.amount ELSE 0 END), 0)::numeric AS total_payout_amount,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'SELF' THEN po.amount * es.payout_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS vendor_payout_commission,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'CHILD' THEN po.amount * es.mediator_payout_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS mediator_payout_commission

  FROM params p
  LEFT JOIN eligible_scope es
    ON es.user_id = p.user_id
   AND es.company_id = p.company_id
   AND es.target_date = p.target_date
  LEFT JOIN "Payout" po
    ON po.vendor_id = es.vendor_id
   AND po.company_id = p.company_id
   AND COALESCE(po.is_obsolete, false) = false
   AND po.status IN ('APPROVED', 'REVERSED')
   AND po.approved_at::date = p.target_date
  GROUP BY p.user_id, p.company_id, p.target_date
),

/* =========================
   REVERSE PAYOUT
   ========================= */
payout_reverse AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,

    COALESCE(COUNT(po.id), 0)::int AS total_reverse_payout_records,
    COALESCE(SUM(CASE WHEN es.relation = 'SELF' THEN po.amount ELSE 0 END), 0)::numeric AS total_reverse_payout_amount,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'SELF' THEN po.amount * es.payout_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS vendor_reverse_payout_commission,

    COALESCE(SUM(
      CASE
        WHEN es.relation = 'CHILD' THEN po.amount * es.mediator_payout_commission / 100.0
        ELSE 0
      END
    ), 0)::numeric AS mediator_reverse_payout_commission

  FROM params p
  LEFT JOIN eligible_scope es
    ON es.user_id = p.user_id
   AND es.company_id = p.company_id
   AND es.target_date = p.target_date
  LEFT JOIN "Payout" po
    ON po.vendor_id = es.vendor_id
   AND po.company_id = p.company_id
   AND COALESCE(po.is_obsolete, false) = false
   AND po.status = 'REVERSED'
   AND po.updated_at::date = p.target_date
  GROUP BY p.user_id, p.company_id, p.target_date
),

/* =========================
   SETTLEMENT
   ========================= */
settlement_rows AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,
    s.id,
    es.relation,
    s.method,
    s.status,
    UPPER(COALESCE(s.config ->> 'debit_credit', '')) AS debit_credit,
    s.amount::numeric AS amount,

    CASE
      WHEN s.approved_at::date = p.target_date
       AND s.status IN ('SUCCESS', 'REVERSED')
      THEN 1

      WHEN s.status = 'REVERSED'
       AND COALESCE(s.rejected_at::date, s.updated_at::date) = p.target_date
       AND COALESCE(s.approved_at::date, s.created_at::date) <> p.target_date
      THEN -1

      ELSE 0
    END AS signed_settlement_count,

    CASE
      WHEN s.approved_at::date = p.target_date
       AND s.status IN ('SUCCESS', 'REVERSED')
       AND s.method NOT IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
      THEN s.amount::numeric
      ELSE 0::numeric
    END AS sent_settlement_amount,

    CASE
      WHEN s.status = 'REVERSED'
       AND COALESCE(s.rejected_at::date, s.updated_at::date) = p.target_date
       AND COALESCE(s.approved_at::date, s.created_at::date) <> p.target_date
       AND s.method NOT IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
      THEN s.amount::numeric
      ELSE 0::numeric
    END AS reversed_settlement_amount,

    CASE
      WHEN s.approved_at::date = p.target_date
       AND s.status IN ('SUCCESS', 'REVERSED')
       AND s.method IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
      THEN s.amount::numeric
      ELSE 0::numeric
    END AS internal_settlement_amount,

    CASE
      WHEN s.status = 'REVERSED'
       AND COALESCE(s.rejected_at::date, s.updated_at::date) = p.target_date
       AND COALESCE(s.approved_at::date, s.created_at::date) <> p.target_date
       AND s.method IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
      THEN s.amount::numeric
      ELSE 0::numeric
    END AS reversed_internal_settlement_amount,

    CASE
      WHEN s.approved_at::date = p.target_date
       AND s.status IN ('SUCCESS', 'REVERSED')
      THEN s.amount::numeric

      WHEN s.status = 'REVERSED'
       AND COALESCE(s.rejected_at::date, s.updated_at::date) = p.target_date
       AND COALESCE(s.approved_at::date, s.created_at::date) <> p.target_date
      THEN -s.amount::numeric

      ELSE 0::numeric
    END AS signed_amount,

    CASE
      WHEN s.method IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
       AND es.relation = 'SELF'
      THEN s.amount::numeric * es.payin_commission / 100.0
      ELSE 0
    END AS vendor_internal_commission,

    CASE
      WHEN s.method IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
       AND es.relation = 'CHILD'
      THEN s.amount::numeric * es.mediator_payin_commission / 100.0
      ELSE 0
    END AS mediator_internal_commission

  FROM params p
  LEFT JOIN eligible_scope es
    ON es.user_id = p.user_id
   AND es.company_id = p.company_id
   AND es.target_date = p.target_date
  LEFT JOIN "Settlement" s
    ON s.user_id = es.vendor_user_id
   AND s.company_id = p.company_id
   AND COALESCE(s.is_obsolete, false) = false
   AND s.status IN ('SUCCESS', 'REVERSED')
),

settlement AS (
  SELECT
    user_id,
    company_id,
    target_date,

    COALESCE(SUM(
      CASE
        WHEN relation = 'SELF' THEN signed_settlement_count
        WHEN relation = 'CHILD'
          AND COALESCE(mediator_internal_commission, 0) <> 0
        THEN signed_settlement_count
        ELSE 0
      END
    ), 0)::int AS total_settlement_records,

    COALESCE(SUM(
      CASE
        WHEN relation = 'SELF' THEN signed_amount
        ELSE 0
      END
    ), 0)::numeric AS total_settlement_amount,

    COALESCE(SUM(
      CASE WHEN relation = 'SELF' THEN sent_settlement_amount ELSE 0 END
    ), 0)::numeric AS total_sent_settlement_amount,

    COALESCE(SUM(
      CASE WHEN relation = 'SELF' THEN reversed_settlement_amount ELSE 0 END
    ), 0)::numeric AS total_reversed_settlement_amount,

    COALESCE(SUM(
      CASE WHEN relation = 'SELF' THEN internal_settlement_amount ELSE 0 END
    ), 0)::numeric AS total_internal_settlement_amount,

    COALESCE(SUM(
      CASE WHEN relation = 'SELF' THEN reversed_internal_settlement_amount ELSE 0 END
    ), 0)::numeric AS total_reversed_internal_settlement_amount,

    COALESCE(SUM(
      CASE
        WHEN signed_settlement_count = 1 THEN vendor_internal_commission
        WHEN signed_settlement_count = -1 THEN -vendor_internal_commission
        ELSE 0
      END
    ), 0)::numeric AS vendor_settlement_commission,

    COALESCE(SUM(
      CASE
        WHEN signed_settlement_count = 1 THEN mediator_internal_commission
        WHEN signed_settlement_count = -1 THEN -mediator_internal_commission
        ELSE 0
      END
    ), 0)::numeric AS mediator_settlement_commission

  FROM settlement_rows
  GROUP BY user_id, company_id, target_date
),

settlement_config AS (
  SELECT
    user_id,
    company_id,
    target_date,
    jsonb_build_object(
      'total_aedSentSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'AED' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_bankSentSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'BANK' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_cashSentSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'CASH' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_cryptoSentSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'CRYPTO' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_internalSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'INTERNAL_QR_TRANSFER' THEN signed_amount ELSE 0 END), 0),
      'total_internalBankSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'INTERNAL_BANK_TRANSFER' THEN signed_amount ELSE 0 END), 0),
      'total_aedReceivedSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'AED' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0),
      'total_bankReceivedSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'BANK' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0),
      'total_cashReceivedSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'CASH' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0),
      'total_cryptoReceivedSettlement_amount', COALESCE(SUM(CASE WHEN relation = 'SELF' AND method = 'CRYPTO' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0)
    ) AS config
  FROM settlement_rows
  GROUP BY user_id, company_id, target_date
),

/* =========================
   CHARGEBACK
   ========================= */
chargeback AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,
    COALESCE(COUNT(c.id), 0)::int AS total_chargeback_records,
    COALESCE(SUM(c.amount), 0)::numeric AS total_chargeback_amount
  FROM params p
  LEFT JOIN eligible_scope es
    ON es.user_id = p.user_id
   AND es.company_id = p.company_id
   AND es.target_date = p.target_date
   AND es.relation = 'SELF'
  LEFT JOIN "ChargeBack" c
    ON c.vendor_user_id = es.vendor_user_id
   AND c.company_id = p.company_id
   AND COALESCE(c.is_obsolete, false) = false
   AND COALESCE(c.reference_date::date, c.created_at::date) = p.target_date
  GROUP BY p.user_id, p.company_id, p.target_date
),

daily_calc AS (
  SELECT
    p.user_id,
    p.company_id,
    p.target_date,

    COALESCE(pi.total_payin_records, 0) AS total_payin_records,
    ROUND(COALESCE(pi.total_payin_amount, 0), 2) AS total_payin_amount,
    ROUND(COALESCE(pi.vendor_payin_commission, 0) + COALESCE(pi.mediator_payin_commission, 0), 2) AS total_payin_commission,

    COALESCE(po.total_payout_records, 0) AS total_payout_records,
    ROUND(COALESCE(po.total_payout_amount, 0), 2) AS total_payout_amount,
    ROUND(COALESCE(po.vendor_payout_commission, 0) + COALESCE(po.mediator_payout_commission, 0), 2) AS total_payout_commission,

    COALESCE(pr.total_reverse_payout_records, 0) AS total_reverse_payout_records,
    ROUND(COALESCE(pr.total_reverse_payout_amount, 0), 2) AS total_reverse_payout_amount,
    ROUND( - COALESCE(pr.vendor_reverse_payout_commission, 0) + COALESCE(pr.mediator_reverse_payout_commission, 0), 2) AS total_reverse_payout_commission,

    COALESCE(st.total_settlement_records, 0) AS total_settlement_records,
    ROUND(COALESCE(st.total_settlement_amount, 0), 2) AS total_settlement_amount,
    ROUND(COALESCE(st.vendor_settlement_commission, 0) + COALESCE(st.mediator_settlement_commission, 0), 2) AS total_settlement_commission,

    COALESCE(cb.total_chargeback_records, 0) AS total_chargeback_records,
    ROUND(COALESCE(cb.total_chargeback_amount, 0), 2) AS total_chargeback_amount,

    COALESCE(ad.total_adjustment_records, 0) AS total_adjustment_count,
    ROUND(COALESCE(ad.total_adjustment_amount, 0), 2) AS total_adjustment_amount,
    ROUND(COALESCE(ad.vendor_adjustment_commission, 0) + COALESCE(ad.mediator_adjustment_commission, 0), 2) AS total_adjustment_commission,

    COALESCE(sc.config::jsonb, '{}'::jsonb) AS config,

    /* =========================
       CURRENT BALANCE FORMULA:
       payin - payout - payin_commission - payout_commission 
       + rev_payout + rev_payout_commission - chargeback 
       + (+sent_settlement - rev_settlement + internal_settlement - reversed_internal_settlement) + (+settlement_commission)
       ========================= */
    ROUND(
      COALESCE(pi.total_payin_amount, 0)
      - COALESCE(po.total_payout_amount, 0)
      - COALESCE(pi.vendor_payin_commission, 0)
      - COALESCE(pi.mediator_payin_commission, 0)
      - COALESCE(po.vendor_payout_commission, 0)
      - COALESCE(po.mediator_payout_commission, 0)
      + COALESCE(pr.total_reverse_payout_amount, 0)
      + COALESCE(pr.vendor_reverse_payout_commission, 0)
      + COALESCE(pr.mediator_reverse_payout_commission, 0)
      - COALESCE(cb.total_chargeback_amount, 0)
      + (
        + COALESCE(st.total_sent_settlement_amount, 0)
        - COALESCE(st.total_reversed_settlement_amount, 0)
        - COALESCE(st.total_internal_settlement_amount, 0)
        + COALESCE(st.total_reversed_internal_settlement_amount, 0)
      )
      + (
        + COALESCE(st.vendor_settlement_commission, 0)
        + COALESCE(st.mediator_settlement_commission, 0)
      ),
      2
    ) AS current_balance,

    -- Raw adjustment values for net_balance calculation
    COALESCE(ad.total_adjustment_amount, 0)::numeric AS raw_adjustment_amount,
    COALESCE(ad.vendor_adjustment_commission, 0)::numeric AS raw_vendor_adjustment_commission,
    COALESCE(ad.mediator_adjustment_commission, 0)::numeric AS raw_mediator_adjustment_commission

  FROM params p
  LEFT JOIN payin pi USING (user_id, company_id, target_date)
  LEFT JOIN adjustment ad USING (user_id, company_id, target_date)
  LEFT JOIN payout po USING (user_id, company_id, target_date)
  LEFT JOIN payout_reverse pr USING (user_id, company_id, target_date)
  LEFT JOIN settlement st USING (user_id, company_id, target_date)
  LEFT JOIN settlement_config sc USING (user_id, company_id, target_date)
  LEFT JOIN chargeback cb USING (user_id, company_id, target_date)
),

/* =========================
   SEED BALANCE
   Fetches the raw net_balance from the day before from_date.
   NO FORMULA APPLIED - just the direct value from the database.
   ========================= */
seed_balance AS (
  SELECT
    i.user_id,
    i.company_id,
    -- Just fetch the raw net_balance directly, no formula applied
    COALESCE((
      SELECT c.net_balance
      FROM "Calculation" c
      WHERE c.user_id = i.user_id
        AND c.company_id = i.company_id
        AND COALESCE(c.is_obsolete, false) = false
        AND c.created_at::date < i.from_date
      ORDER BY c.created_at DESC
      LIMIT 1
    ), 0)::numeric AS opening_net_balance
  FROM input_params i
),

rolling_balance AS (
  /* =========================
     FIRST DAY:
     net_balance = opening_net_balance (raw from DB) + current_balance + adjustment_effect
     
     Opening balance is used AS-IS from the database.
     Formula is only applied for the current day's calculation.
     ========================= */
  SELECT
    dc.user_id,
    dc.company_id,
    dc.target_date,
    dc.total_payin_records,
    dc.total_payin_amount,
    dc.total_payin_commission,
    dc.total_payout_records,
    dc.total_payout_amount,
    dc.total_payout_commission,
    dc.total_reverse_payout_records,
    dc.total_reverse_payout_amount,
    dc.total_reverse_payout_commission,
    dc.total_settlement_records,
    dc.total_settlement_amount,
    dc.total_settlement_commission,
    dc.total_chargeback_records,
    dc.total_chargeback_amount,
    dc.total_adjustment_count,
    dc.total_adjustment_amount,
    dc.total_adjustment_commission,
    dc.config,
    dc.current_balance,
    ROUND(
      -- Opening balance: raw value from DB (no formula applied)
      sb.opening_net_balance 
      -- Add current_balance for today
      + dc.current_balance 
      -- Add adjustment effect for today only
      + (
        - dc.raw_adjustment_amount 
        + SIGN(dc.raw_adjustment_amount) * (dc.raw_vendor_adjustment_commission + dc.raw_mediator_adjustment_commission)
      ),
      2
    ) AS net_balance
  FROM daily_calc dc
  JOIN seed_balance sb
    ON sb.user_id = dc.user_id
   AND sb.company_id = dc.company_id
  WHERE dc.target_date = (SELECT MIN(target_date) FROM date_range)

  UNION ALL

  /* =========================
     SUBSEQUENT DAYS:
     net_balance = previous_day_net_balance + current_balance + adjustment_effect
     
     Previous day's net_balance is used directly (already calculated).
     Formula is applied for the current day's calculation only.
     ========================= */
  SELECT
    dc.user_id,
    dc.company_id,
    dc.target_date,
    dc.total_payin_records,
    dc.total_payin_amount,
    dc.total_payin_commission,
    dc.total_payout_records,
    dc.total_payout_amount,
    dc.total_payout_commission,
    dc.total_reverse_payout_records,
    dc.total_reverse_payout_amount,
    dc.total_reverse_payout_commission,
    dc.total_settlement_records,
    dc.total_settlement_amount,
    dc.total_settlement_commission,
    dc.total_chargeback_records,
    dc.total_chargeback_amount,
    dc.total_adjustment_count,
    dc.total_adjustment_amount,
    dc.total_adjustment_commission,
    dc.config,
    dc.current_balance,
    ROUND(
      -- Previous day's net_balance (used as-is)
      rb.net_balance 
      -- Add current_balance for today
      + dc.current_balance 
      -- Add adjustment effect for today only
      + (
        - dc.raw_adjustment_amount 
        + SIGN(dc.raw_adjustment_amount) * (dc.raw_vendor_adjustment_commission + dc.raw_mediator_adjustment_commission)
      ),
      2
    ) AS net_balance
  FROM daily_calc dc
  JOIN rolling_balance rb
    ON rb.user_id = dc.user_id
   AND rb.company_id = dc.company_id
   AND dc.target_date = (rb.target_date + INTERVAL '1 day')::date
),

updated AS (
  UPDATE "Calculation" calc
  SET
    total_payin_count = rb.total_payin_records,
    total_payin_amount = rb.total_payin_amount,
    total_payin_commission = rb.total_payin_commission,

    total_payout_count = rb.total_payout_records,
    total_payout_amount = rb.total_payout_amount,
    total_payout_commission = rb.total_payout_commission,

    total_reverse_payout_count = rb.total_reverse_payout_records,
    total_reverse_payout_amount = rb.total_reverse_payout_amount,
    total_reverse_payout_commission = rb.total_reverse_payout_commission,

    total_settlement_count = rb.total_settlement_records,
    total_settlement_amount = rb.total_settlement_amount,
    total_settlement_commission = rb.total_settlement_commission,

    total_chargeback_count = rb.total_chargeback_records,
    total_chargeback_amount = rb.total_chargeback_amount,

    total_adjustment_count = rb.total_adjustment_count,
    total_adjustment_amount = rb.total_adjustment_amount,
    total_adjustment_commission = rb.total_adjustment_commission,

    config = rb.config,
    current_balance = rb.current_balance,
    net_balance = rb.net_balance,
    updated_at = NOW()
  FROM rolling_balance rb, input_params ip
  WHERE ip.run_mode = 'UPDATE'
    AND calc.user_id = rb.user_id
    AND calc.company_id = rb.company_id
    AND calc.created_at::date = rb.target_date
    AND COALESCE(calc.is_obsolete, false) = false
  RETURNING calc.id, calc.user_id, calc.company_id, calc.created_at::date AS calc_date
)

SELECT
  ip.run_mode,
  rb.target_date,
  rb.total_payin_records,
  rb.total_payin_amount,
  rb.total_payin_commission,
  rb.total_payout_records,
  rb.total_payout_amount,
  rb.total_payout_commission,
  rb.total_reverse_payout_records,
  rb.total_reverse_payout_amount,
  rb.total_reverse_payout_commission,
  rb.total_settlement_records,
  rb.total_settlement_amount,
  rb.total_settlement_commission,
  rb.total_chargeback_records,
  rb.total_chargeback_amount,
  rb.total_adjustment_count,
  rb.total_adjustment_amount,
  rb.total_adjustment_commission,
  rb.current_balance,
  rb.net_balance,
  rb.config,
  CASE
    WHEN ip.run_mode = 'PREVIEW' THEN 'Preview only - no rows updated'
    ELSE 'Update applied'
  END AS status
FROM rolling_balance rb
CROSS JOIN input_params ip
ORDER BY rb.target_date;










