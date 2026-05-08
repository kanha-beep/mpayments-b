import { decryptBhpayPayload, encryptBhpayPayload } from "./bhpayCryptoService.js";

const PROVIDER_BASE_URL = process.env.PROVIDER_BASE_URL || "https://api-beta.bharatpay.cc";
const PROVIDER_PANEL_BASE_URL = process.env.PROVIDER_PANEL_BASE_URL || "https://doc-en.bharatpay.cc";

function buildProviderHeaders(merchant) {
  return {
    "Content-Type": "application/json",
    Authorization: merchant.merchantId,
  };
}

function buildBhpayError(message, extra = {}) {
  return {
    status: "error",
    message,
    ...extra,
  };
}

function mapProcessCodeToStatus(processCode, type = "payin") {
  if (processCode === 30) return "success";
  if (type === "payout" && processCode === 40) return "failed";
  if (type === "payout" && processCode === 50) return "reversal";
  return "pending";
}

async function parseProviderResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: 1, errorDesc: "Invalid provider response", raw: text };
  }
}

async function requestProvider({ path, method = "POST", merchant, payload, queryParams }) {
  try {
    const url = new URL(`${PROVIDER_BASE_URL}${path}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(url, {
      method,
      headers: buildProviderHeaders(merchant),
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await parseProviderResponse(response);
    return { ok: response.ok && data.code === 0, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      data: buildBhpayError(`Provider request failed: ${error.cause?.code || error.code || error.message}`),
    };
  }
}

function getCreditInfo(data) {
  return data?.result?.channelCreditOrderSimpleInfo || null;
}

function getCreditPayment(data) {
  return data?.result?.channelPaymentRecordSimpleInfo || null;
}

function getDebitInfo(data) {
  return data?.result?.channelDebitOrderSimpleInfo || null;
}

function getDebitPayment(data) {
  return data?.result?.channelPayoutRecordSimpleInfo || data?.result?.channelPaymentRecordSimpleInfo || null;
}

export function getProviderBaseUrl() {
  return PROVIDER_BASE_URL;
}

export function getProviderPanelBaseUrl() {
  return PROVIDER_PANEL_BASE_URL;
}

export async function createProviderPaymentLink({ merchant, transactionId, amount, callbackUrl, payerAccountDetailList }) {
  const encrypted = encryptBhpayPayload(
    {
      amount: Number(amount),
      sourceNo: transactionId,
      callbackUrl: callbackUrl || undefined,
      payerAccountDetailList: payerAccountDetailList || undefined,
    },
    merchant.authToken,
  );

  const upstream = await requestProvider({
    path: "/api/channel/Credit/Place",
    merchant,
    payload: { data: encrypted },
  });

  if (!upstream.ok) {
    return {
      ...upstream,
      data: buildBhpayError(upstream.data?.errorDesc || upstream.data?.message || "Payment link not generated", {
        provider: upstream.data,
      }),
    };
  }

  const creditInfo = getCreditInfo(upstream.data);
  const paymentInfo = getCreditPayment(upstream.data);
  const deeplink = upstream.data?.result?.deeplink || {};

  return {
    ...upstream,
    data: {
      error: false,
      status: 200,
      message: "Success.",
      paymentLink: creditInfo?.cashierLink || "",
      upiLink: deeplink.other || deeplink.gpay || deeplink.phonepe || deeplink.paytmmp || paymentInfo?.upiUrl || "",
      provider: upstream.data,
    },
  };
}

export async function fetchProviderOrderStatus({ merchant, type, transactionId }) {
  const isPayout = type === "payout";
  const encrypted = encryptBhpayPayload({ sourceNo: transactionId }, merchant.authToken);
  const upstream = await requestProvider({
    path: isPayout ? "/api/channel/Debit/GetV2" : "/api/channel/Credit/GetV2",
    merchant,
    payload: { data: encrypted },
  });

  if (!upstream.ok) {
    return {
      ...upstream,
      data: buildBhpayError(upstream.data?.errorDesc || upstream.data?.message || "Unable to fetch order status", {
        provider: upstream.data,
      }),
    };
  }

  const orderInfo = isPayout ? getDebitInfo(upstream.data) : getCreditInfo(upstream.data);
  const paymentInfo = isPayout ? getDebitPayment(upstream.data) : getCreditPayment(upstream.data);
  const txnStatus = mapProcessCodeToStatus(orderInfo?.processCode, isPayout ? "payout" : "payin");

  return {
    ...upstream,
    data: {
      statuscode: "TXN",
      txn_status: txnStatus,
      txnid: transactionId,
      amount: orderInfo?.fiatAmount,
      utr: paymentInfo?.utr || "",
      bankutr: paymentInfo?.utr || "",
      errorMessage: paymentInfo?.errorMessage || "",
      provider: upstream.data,
    },
  };
}

export async function createProviderPayout({ merchant, transactionId, amount, callbackUrl, payeeAccountDetail }) {
  const encrypted = encryptBhpayPayload(
    {
      amount: Number(amount),
      sourceNo: transactionId,
      callbackUrl: callbackUrl || undefined,
      payeeAccountDetail,
    },
    merchant.authToken,
  );

  const upstream = await requestProvider({
    path: "/api/channel/Debit/Place",
    merchant,
    payload: { data: encrypted },
  });

  if (!upstream.ok) {
    return {
      ...upstream,
      data: buildBhpayError(upstream.data?.errorDesc || upstream.data?.message || "Payout request failed", {
        provider: upstream.data,
      }),
    };
  }

  return {
    ...upstream,
    data: {
      status: "success",
      message: "Payout request submitted",
      provider: upstream.data,
    },
  };
}

export async function fetchProviderWallet({ merchant }) {
  const upstream = await requestProvider({
    path: "/api/channel/Merchant/Balance",
    method: "GET",
    merchant,
  });

  if (!upstream.ok) {
    return {
      ...upstream,
      data: buildBhpayError(upstream.data?.errorDesc || upstream.data?.message || "Unable to fetch balance", {
        provider: upstream.data,
      }),
    };
  }

  return {
    ...upstream,
    data: {
      status: "success",
      wallet_balance: upstream.data?.result?.remainBalance ?? upstream.data?.result?.balance ?? 0,
      frozen_balance: upstream.data?.result?.frozenBalance ?? 0,
      total_balance: upstream.data?.result?.balance ?? 0,
      provider: upstream.data,
    },
  };
}

export function parseBhpayCallback({ encryptedData, merchant }) {
  return decryptBhpayPayload(encryptedData, merchant.authToken);
}
