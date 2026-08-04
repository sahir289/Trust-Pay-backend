/* ============================================================
   MERCHANT CALCULATION BACKFILL SCRIPT
   Covers:
   - MERCHANT
   - payin
   - payout
   - reverse payout
   - settlement (SUCCESS / REVERSED + commission + config)
   - chargeback
   - adjustment
   - rolling net_balance = previous net_balance + current_balance + adjustment_effect

   FORMULAS:
   current_balance = (payin - payout - settlement - chargeback + reverse_payout)
                     - (payin_commission + payout_commission - reverse_payout_commission)
                     + settlement_commission

   net_balance = previous_net_balance + current_balance + adjustment_effect

   adjustment_effect:
     - Positive adj (+500): -500 + commission
     - Negative adj (-250): +250 - commission
     Formula: -adjustment_amount + SIGN(adjustment_amount) * commission

   NOTE:
   - merchant_id is resolved from user_id via Merchant table
   - Opening/seed net_balance (day before from_date) is fetched
     directly from the database WITHOUT any formula applied.
   - total_reverse_payout_commission is stored as NEGATIVE

   SAFE USAGE:
   1) Run first with run_mode = 'PREVIEW'
   2) Verify output
   3) Change run_mode = 'UPDATE'
   ============================================================ */

WITH RECURSIVE

input_params AS (
  SELECT
    $1::text        AS run_mode,      -- 'PREVIEW' | 'UPDATE'
    $2::varchar     AS user_id,       -- merchant user_id
    $3::varchar     AS company_id,
    $4::date        AS from_date,
    $5::date        AS to_date
),

/* =========================
   RESOLVE merchant_id FROM user_id
   ========================= */
merchant_lookup AS (
  SELECT
    i.user_id,
    i.company_id,
    i.run_mode,
    i.from_date,
    i.to_date,
    m.id AS merchant_id
  FROM input_params i
  JOIN public."Merchant" m
    ON m.user_id = i.user_id
   AND COALESCE(m.is_obsolete, false) = false
  LIMIT 1
),

date_range AS (
  SELECT from_date AS target_date
  FROM merchant_lookup

  UNION ALL

  SELECT (target_date + INTERVAL '1 day')::date
  FROM date_range, merchant_lookup
  WHERE target_date < merchant_lookup.to_date
),

params AS (
  SELECT
    ml.user_id,
    ml.company_id,
    ml.merchant_id,
    ml.run_mode,
    d.target_date
  FROM merchant_lookup ml
  CROSS JOIN date_range d
),

/* =========================
   PAYIN
   ========================= */
payin AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,

    COALESCE(COUNT(pi.id), 0)::int AS total_payin_records,
    COALESCE(SUM(pi.amount), 0)::numeric AS total_payin_amount,
    COALESCE(SUM(pi.payin_merchant_commission), 0)::numeric AS total_payin_merchant_commission

  FROM params p
  LEFT JOIN public."Payin" pi
    ON pi.merchant_id = p.merchant_id
   AND pi.approved_at::date = p.target_date
   AND pi.status = 'SUCCESS'
   AND COALESCE(pi.is_obsolete, false) = false
  GROUP BY p.user_id, p.company_id, p.merchant_id, p.target_date
),

/* =========================
   ADJUSTMENT
   Based on Payin.config->'history' array
   - history contains previous snapshots
   - current amount/commission = latest
   - Multiple adjustments possible
   - Fixed: explicit ::jsonb casts to avoid json/jsonb mismatch
   ========================= */
adjustment AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,

    COALESCE(COUNT(adj.payin_id), 0)::int AS total_adjustment_records,

    COALESCE(SUM( - adj.adjustment_amount), 0)::numeric AS total_adjustment_amount,

    COALESCE(SUM( - adj.adjustment_commission), 0)::numeric AS total_adjustment_commission

  FROM params p
  LEFT JOIN (
    WITH payin_snapshots AS (
      /* History entries */
      SELECT
        pi.id AS payin_id,
        pi.merchant_id,
        (h.elem->>'amount')::numeric                         AS snap_amount,
        (h.elem->>'payin_merchant_commission')::numeric       AS snap_merchant_comm,
        (h.elem->>'updated_at')::timestamptz                  AS snap_at,
        h.ordinality                                         AS snap_order
      FROM public."Payin" pi
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE( (pi.config::jsonb) -> 'history', '[]'::jsonb )
      ) WITH ORDINALITY AS h(elem, ordinality)
      WHERE COALESCE(pi.is_obsolete, false) = false
        AND pi.status = 'SUCCESS'

      UNION ALL

      /* Current state as latest snapshot */
      SELECT
        pi.id AS payin_id,
        pi.merchant_id,
        pi.amount::numeric                                   AS snap_amount,
        COALESCE(pi.payin_merchant_commission, 0)::numeric   AS snap_merchant_comm,
        pi.updated_at                                        AS snap_at,
        999999                                               AS snap_order
      FROM public."Payin" pi
      WHERE COALESCE(pi.is_obsolete, false) = false
        AND pi.status = 'SUCCESS'
        AND jsonb_array_length(
              COALESCE( (pi.config::jsonb) -> 'history', '[]'::jsonb )
            ) > 0
    ),

    ordered_snaps AS (
      SELECT
        payin_id,
        merchant_id,
        snap_amount,
        snap_merchant_comm,
        snap_at,
        ROW_NUMBER() OVER (
          PARTITION BY payin_id
          ORDER BY snap_at ASC, snap_order ASC
        ) AS rn
      FROM payin_snapshots
    ),

    deltas AS (
      SELECT
        curr.payin_id,
        curr.merchant_id,
        curr.snap_at::date AS adjustment_date,
        (curr.snap_amount - prev.snap_amount) AS adjustment_amount,
        (curr.snap_merchant_comm - prev.snap_merchant_comm) AS adjustment_commission
      FROM ordered_snaps curr
      JOIN ordered_snaps prev
        ON prev.payin_id = curr.payin_id
       AND prev.rn = curr.rn - 1
      WHERE curr.snap_amount IS DISTINCT FROM prev.snap_amount
    )

    SELECT
      d.payin_id,
      d.merchant_id,
      d.adjustment_date,
      d.adjustment_amount,
      d.adjustment_commission
    FROM deltas d
  ) adj
    ON adj.merchant_id = p.merchant_id
   AND adj.adjustment_date = p.target_date

  GROUP BY p.user_id, p.company_id, p.merchant_id, p.target_date
),

/* =========================
   PAYOUT
   ========================= */
payout AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,

    COALESCE(COUNT(po.id), 0)::int AS total_payout_records,
    COALESCE(SUM(po.amount), 0)::numeric AS total_payout_amount,
    COALESCE(SUM(po.payout_merchant_commission), 0)::numeric AS total_payout_merchant_commission

  FROM params p
  LEFT JOIN public."Payout" po
    ON po.merchant_id = p.merchant_id
   AND po.approved_at::date = p.target_date
   AND po.status IN ('APPROVED', 'REVERSED')
   AND COALESCE(po.is_obsolete, false) = false
  GROUP BY p.user_id, p.company_id, p.merchant_id, p.target_date
),

/* =========================
   REVERSE PAYOUT
   ========================= */
payout_reverse AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,

    COALESCE(COUNT(pr.id), 0)::int AS total_reverse_payout_records,
    COALESCE(SUM(pr.amount), 0)::numeric AS total_reverse_payout_amount,
    COALESCE(SUM(pr.payout_merchant_commission), 0)::numeric AS total_reverse_payout_merchant_commission

  FROM params p
  LEFT JOIN public."Payout" pr
    ON pr.merchant_id = p.merchant_id
   AND TO_TIMESTAMP(pr.config->>'reversed_at', 'DD-MM-YYYY HH12:MI:SS AM')::date = p.target_date
   AND pr.status = 'REVERSED'
   AND COALESCE(pr.is_obsolete, false) = false
  GROUP BY p.user_id, p.company_id, p.merchant_id, p.target_date
),

/* =========================
   SETTLEMENT ROWS (for commission + config + signed amounts)
   ========================= */
settlement_rows AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,
    s.id,
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

    -- Merchant settlement commission (if stored on settlement, else 0)
    CASE
      WHEN s.method IN ('INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER')
      THEN COALESCE(NULLIF(s.config ->> 'merchant_commission', '')::numeric, 0)
      ELSE 0
    END AS merchant_settlement_commission

  FROM params p
  LEFT JOIN public."Settlement" s
    ON s.user_id = p.user_id
   AND s.company_id = p.company_id
   AND COALESCE(s.is_obsolete, false) = false
   AND s.status IN ('SUCCESS', 'REVERSED')
),

settlement AS (
  SELECT
    user_id,
    company_id,
    merchant_id,
    target_date,

    COALESCE(SUM(signed_settlement_count), 0)::int AS total_settlement_records,

    COALESCE(SUM(signed_amount), 0)::numeric AS total_settlement_amount,

    COALESCE(SUM(sent_settlement_amount), 0)::numeric AS total_sent_settlement_amount,
    COALESCE(SUM(reversed_settlement_amount), 0)::numeric AS total_reversed_settlement_amount,
    COALESCE(SUM(internal_settlement_amount), 0)::numeric AS total_internal_settlement_amount,
    COALESCE(SUM(reversed_internal_settlement_amount), 0)::numeric AS total_reversed_internal_settlement_amount,

    COALESCE(SUM(
      CASE
        WHEN signed_settlement_count = 1 THEN merchant_settlement_commission
        WHEN signed_settlement_count = -1 THEN -merchant_settlement_commission
        ELSE 0
      END
    ), 0)::numeric AS total_settlement_commission

  FROM settlement_rows
  GROUP BY user_id, company_id, merchant_id, target_date
),

settlement_config AS (
  SELECT
    user_id,
    company_id,
    merchant_id,
    target_date,
    jsonb_build_object(
      'total_aedSentSettlement_amount', COALESCE(SUM(CASE WHEN method = 'AED' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_bankSentSettlement_amount', COALESCE(SUM(CASE WHEN method = 'BANK' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_cashSentSettlement_amount', COALESCE(SUM(CASE WHEN method = 'CASH' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_cryptoSentSettlement_amount', COALESCE(SUM(CASE WHEN method = 'CRYPTO' AND debit_credit = 'SENT' THEN signed_amount ELSE 0 END), 0),
      'total_internalSettlement_amount', COALESCE(SUM(CASE WHEN method = 'INTERNAL_QR_TRANSFER' THEN signed_amount ELSE 0 END), 0),
      'total_internalBankSettlement_amount', COALESCE(SUM(CASE WHEN method = 'INTERNAL_BANK_TRANSFER' THEN signed_amount ELSE 0 END), 0),
      'total_aedReceivedSettlement_amount', COALESCE(SUM(CASE WHEN method = 'AED' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0),
      'total_bankReceivedSettlement_amount', COALESCE(SUM(CASE WHEN method = 'BANK' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0),
      'total_cashReceivedSettlement_amount', COALESCE(SUM(CASE WHEN method = 'CASH' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0),
      'total_cryptoReceivedSettlement_amount', COALESCE(SUM(CASE WHEN method = 'CRYPTO' AND debit_credit = 'RECEIVED' THEN -signed_amount ELSE 0 END), 0)
    ) AS config
  FROM settlement_rows
  GROUP BY user_id, company_id, merchant_id, target_date
),

/* =========================
   CHARGEBACK
   ========================= */
chargeback AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,

    COALESCE(COUNT(cb.id), 0)::int AS total_chargeback_records,
    COALESCE(SUM(cb.amount), 0)::numeric AS total_chargeback_amount

  FROM params p
  LEFT JOIN public."ChargeBack" cb
    ON cb.merchant_user_id = p.user_id
   AND cb.company_id = p.company_id
   AND cb.created_at::date = p.target_date
   AND COALESCE(cb.is_obsolete, false) = false
  GROUP BY p.user_id, p.company_id, p.merchant_id, p.target_date
),

daily_calc AS (
  SELECT
    p.user_id,
    p.company_id,
    p.merchant_id,
    p.target_date,

    COALESCE(pi.total_payin_records, 0) AS total_payin_records,
    ROUND(COALESCE(pi.total_payin_amount, 0), 2) AS total_payin_amount,
    ROUND(COALESCE(pi.total_payin_merchant_commission, 0), 2) AS total_payin_commission,

    COALESCE(po.total_payout_records, 0) AS total_payout_records,
    ROUND(COALESCE(po.total_payout_amount, 0), 2) AS total_payout_amount,
    ROUND(COALESCE(po.total_payout_merchant_commission, 0), 2) AS total_payout_commission,

    COALESCE(pr.total_reverse_payout_records, 0) AS total_reverse_payout_records,
    ROUND(COALESCE(pr.total_reverse_payout_amount, 0), 2) AS total_reverse_payout_amount,
    ROUND(-COALESCE(pr.total_reverse_payout_merchant_commission, 0), 2) AS total_reverse_payout_commission,

    COALESCE(st.total_settlement_records, 0) AS total_settlement_records,
    ROUND(COALESCE(st.total_settlement_amount, 0), 2) AS total_settlement_amount,
    ROUND(COALESCE(st.total_settlement_commission, 0), 2) AS total_settlement_commission,

    COALESCE(cb.total_chargeback_records, 0) AS total_chargeback_records,
    ROUND(COALESCE(cb.total_chargeback_amount, 0), 2) AS total_chargeback_amount,

    COALESCE(ad.total_adjustment_records, 0) AS total_adjustment_count,
    ROUND(COALESCE(ad.total_adjustment_amount, 0), 2) AS total_adjustment_amount,
    ROUND(COALESCE(ad.total_adjustment_commission, 0), 2) AS total_adjustment_commission,

    COALESCE(sc.config::jsonb, '{}'::jsonb) AS config,

    /* =========================
       CURRENT BALANCE FORMULA
       ========================= */
    ROUND(
      (
        COALESCE(pi.total_payin_amount, 0)
        - COALESCE(po.total_payout_amount, 0)
        - COALESCE(st.total_settlement_amount, 0)
        - COALESCE(cb.total_chargeback_amount, 0)
        + COALESCE(pr.total_reverse_payout_amount, 0)
      )
      - (
        COALESCE(pi.total_payin_merchant_commission, 0)
        + COALESCE(po.total_payout_merchant_commission, 0)
        - COALESCE(pr.total_reverse_payout_merchant_commission, 0)
      )
      + COALESCE(st.total_settlement_commission, 0),
      2
    ) AS current_balance,

    -- Raw adjustment values for net_balance
    COALESCE(ad.total_adjustment_amount, 0)::numeric AS raw_adjustment_amount,
    COALESCE(ad.total_adjustment_commission, 0)::numeric AS raw_adjustment_commission

  FROM params p
  LEFT JOIN payin pi
    USING (user_id, company_id, merchant_id, target_date)
  LEFT JOIN adjustment ad
    USING (user_id, company_id, merchant_id, target_date)
  LEFT JOIN payout po
    USING (user_id, company_id, merchant_id, target_date)
  LEFT JOIN payout_reverse pr
    USING (user_id, company_id, merchant_id, target_date)
  LEFT JOIN settlement st
    USING (user_id, company_id, merchant_id, target_date)
  LEFT JOIN settlement_config sc
    USING (user_id, company_id, merchant_id, target_date)
  LEFT JOIN chargeback cb
    USING (user_id, company_id, merchant_id, target_date)
),

/* =========================
   SEED BALANCE
   ========================= */
seed_balance AS (
  SELECT
    ml.user_id,
    ml.company_id,
    COALESCE((
      SELECT c.net_balance
      FROM public."Calculation" c
      WHERE c.user_id = ml.user_id
        AND c.company_id = ml.company_id
        AND COALESCE(c.is_obsolete, false) = false
        AND c.created_at::date < ml.from_date
      ORDER BY c.created_at DESC
      LIMIT 1
    ), 0)::numeric AS opening_net_balance
  FROM merchant_lookup ml
),

rolling_balance AS (
  /* FIRST DAY */
  SELECT
    dc.user_id,
    dc.company_id,
    dc.merchant_id,
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
      sb.opening_net_balance
      + dc.current_balance,
      2
    ) AS net_balance
  FROM daily_calc dc
  JOIN seed_balance sb
    ON sb.user_id = dc.user_id
   AND sb.company_id = dc.company_id
  WHERE dc.target_date = (SELECT MIN(target_date) FROM date_range)

  UNION ALL

  /* SUBSEQUENT DAYS */
  SELECT
    dc.user_id,
    dc.company_id,
    dc.merchant_id,
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
      rb.net_balance
      + dc.current_balance
      + (
        - dc.raw_adjustment_amount
        + SIGN(dc.raw_adjustment_amount) * dc.raw_adjustment_commission
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
  UPDATE public."Calculation" calc
  SET
    total_payin_count               = rb.total_payin_records,
    total_payin_amount              = rb.total_payin_amount,
    total_payin_commission          = rb.total_payin_commission,

    total_payout_count              = rb.total_payout_records,
    total_payout_amount             = rb.total_payout_amount,
    total_payout_commission         = rb.total_payout_commission,

    total_reverse_payout_count      = rb.total_reverse_payout_records,
    total_reverse_payout_amount     = rb.total_reverse_payout_amount,
    total_reverse_payout_commission = rb.total_reverse_payout_commission,

    total_settlement_count          = rb.total_settlement_records,
    total_settlement_amount         = rb.total_settlement_amount,
    total_settlement_commission     = rb.total_settlement_commission,

    total_chargeback_count          = rb.total_chargeback_records,
    total_chargeback_amount         = rb.total_chargeback_amount,

    total_adjustment_count          = rb.total_adjustment_count,
    total_adjustment_amount         = rb.total_adjustment_amount,
    total_adjustment_commission     = rb.total_adjustment_commission,

    config                          = rb.config,
    current_balance                 = rb.current_balance,
    net_balance                     = rb.net_balance,
    updated_at                      = NOW()
  FROM rolling_balance rb, merchant_lookup ml
  WHERE ml.run_mode = 'UPDATE'
    AND calc.user_id = rb.user_id
    AND calc.company_id = rb.company_id
    AND calc.created_at::date = rb.target_date
    AND COALESCE(calc.is_obsolete, false) = false
  RETURNING calc.id, calc.user_id, calc.company_id, calc.created_at::date AS calc_date
)

SELECT
  ml.run_mode,
  rb.target_date,
  rb.merchant_id,
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
    WHEN ml.run_mode = 'PREVIEW' THEN 'Preview only - no rows updated'
    ELSE 'Update applied'
  END AS status
FROM rolling_balance rb
CROSS JOIN merchant_lookup ml
ORDER BY rb.target_date;