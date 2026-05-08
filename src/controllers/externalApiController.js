import { PaymentLink } from "../models/PaymentLink.js";
import { PayinTransaction } from "../models/PayinTransaction.js";
import { PayoutRequest } from "../models/PayoutRequest.js";
import {
  createProviderPaymentLink,
  createProviderPayout,
  fetchProviderOrderStatus,
  fetchProviderWallet,
  getProviderBaseUrl,
  parseBhpayCallback,
} from "../services/providerService.js";
import {
  normalizeTxnStatus,
  reconcilePayinUpdate,
  reconcilePayoutUpdate,
} from "../services/transactionFlowService.js";

async function merchantFromToken(token) {
  const { Merchant } = await import("../models/Merchant.js");
  return Merchant.findOne({ apiToken: token });
}

export async function createLinkApi(req, res) {
  const { txnid, name, email, mobile, amount, token } = req.body;
  const merchant = await merchantFromToken(token);

  if (!merchant || !txnid || !name || !email || !mobile || !amount) {
    return res.status(400).json({
      status: "failed",
      error: true,
      message: "Payment link not generated",
      paymentLink: "",
    });
  }

  const upstream = await createProviderPaymentLink({
    merchant,
    transactionId: txnid,
    amount,
    callbackUrl: merchant.payinCallbackUrl || undefined,
    payerAccountDetailList: req.body.payerAccountDetailList,
  });
  if (!upstream.ok || upstream.data?.error === true) {
    return res.status(400).json(upstream.data);
  }

  await PaymentLink.findOneAndUpdate(
    { merchant: merchant._id, transactionId: txnid },
    {
      merchant: merchant._id,
      mobile,
      amount: Number(amount),
      transactionId: txnid,
      status: "Pending",
      deepLink: upstream.data.paymentLink,
      upiLink: upstream.data.upiLink || "",
      customerName: name,
      customerEmail: email,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await PayinTransaction.findOneAndUpdate(
    { merchant: merchant._id, requestId: txnid },
    {
      merchant: merchant._id,
      mobile,
      requestId: txnid,
      amount: Number(amount),
      status: "Pending",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json(upstream.data);
}

export async function orderStatusApi(req, res) {
  const { token, type, txnid } = req.body;
  const merchant = await merchantFromToken(token);

  if (!merchant) {
    return res.json({ status: "error", message: "Invalid token" });
  }

  const upstream = await fetchProviderOrderStatus({ merchant, type, transactionId: txnid });
  const data = upstream.data;

  if (type === "payin") {
    const item = await PayinTransaction.findOne({ merchant: merchant._id, requestId: txnid });
    if (item && data?.txn_status) {
      await reconcilePayinUpdate({
        merchant,
        transaction: item,
        status: data.txn_status,
        amount: data.amount,
        mobile: data.mobile,
        utr: data.utr,
        callbackState: data.callback || "POLLED",
      });
    }
  }

  if (type === "payout") {
    const item = await PayoutRequest.findOne({ merchant: merchant._id, transactionId: txnid });
    if (item && data?.txn_status) {
      await reconcilePayoutUpdate({
        merchant,
        payout: item,
        status: data.txn_status,
        amount: data.amount,
        mobile: data.mobile,
        utr: data.bankutr,
        redirectUrl: data.redirect_url,
      });
    }
  }

  res.json(data);
}

export async function payoutRequestApi(req, res) {
  const { token, amount, name, mobile, bank, account, ifsc, holder, mode, txnid, redirect_url } = req.body;
  const merchant = await merchantFromToken(token);

  if (!merchant) {
    return res.json({ status: "error", message: "Invalid token" });
  }

  if (Number(amount) > merchant.payoutWallet) {
    return res.status(400).json({
      status: "error",
      message: "Insufficient payout wallet balance",
    });
  }

  const upstream = await createProviderPayout({
    merchant,
    transactionId: txnid,
    amount,
    callbackUrl: merchant.payoutCallbackUrl || redirect_url || undefined,
    payeeAccountDetail: {
      accountName: holder || name,
      bankNo: ifsc,
      bankAccount: account,
      bankName: bank,
      accountType: mode === "UPI" ? "2" : "1",
      mobile,
    },
  });

  if (upstream.data?.status === "success") {
    await PayoutRequest.findOneAndUpdate(
      { merchant: merchant._id, transactionId: txnid },
      {
        merchant: merchant._id,
        mobile,
        transactionId: txnid,
        amount: Number(amount),
        currentBalance: merchant.payoutWallet,
        charges: 0,
        gst: 0,
        finalBalance: Math.max(merchant.payoutWallet - Number(amount), 0),
        bank,
        accountNumber: account,
        ifscCode: ifsc,
        holderName: holder || name,
        debit: 0,
        remark: name,
        status: "Pending",
        mode: mode || "IMPS",
        redirectUrl: redirect_url || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    merchant.payoutPending += Number(amount);
    await merchant.save();
  }

  res.json(upstream.data);
}

export async function walletFetchApi(req, res) {
  const merchant = await merchantFromToken(req.body.token);
  if (!req.body.token) return res.json({ status: "error", message: "Missing token" });
  if (!merchant) return res.json({ status: "error", message: "Invalid token" });

  const upstream = await fetchProviderWallet({ merchant });
  if (upstream.data?.status === "success" && upstream.data.wallet_balance !== undefined) {
    merchant.payoutWallet = Number(upstream.data.wallet_balance);
    merchant.payoutPending = Number(upstream.data.frozen_balance || merchant.payoutPending || 0);
    await merchant.save();
  }
  res.json(upstream.data);
}

export async function receivePayinCallback(req, res) {
  const sourceNo = req.body.sourceNo || req.query.order_id;
  const transaction = await PayinTransaction.findOne({ requestId: sourceNo }).populate("merchant");
  if (!transaction) return res.status(404).json({ message: "Payin transaction not found" });

  const decrypted = req.body.data ? parseBhpayCallback({ encryptedData: req.body.data, merchant: transaction.merchant }) : null;
  const order = decrypted?.channelCreditOrderSimpleInfo || null;
  const payment = decrypted?.channelPaymentRecordSimpleInfo || null;

  const result = await reconcilePayinUpdate({
    transaction,
    status: order?.processCode === 30 ? "success" : payment?.errorMessage ? "failed" : req.query.status || "pending",
    amount: order?.fiatAmount ?? req.query.amount,
    mobile: transaction.mobile,
    utr: payment?.utr || req.query.utr,
    callbackState: "RECEIVED",
    notifyMerchant: true,
  });

  if (result.ignored) {
    return res.json({ message: "Payin callback ignored", status: result.status });
  }

  res.json({ message: "Payin callback processed", status: result.status });
}

export async function receivePayoutCallback(req, res) {
  const sourceNo = req.body.sourceNo || req.query.order_id;
  const payout = await PayoutRequest.findOne({ transactionId: sourceNo }).populate("merchant");
  if (!payout) return res.status(404).json({ message: "Payout request not found" });

  const decrypted = req.body.data ? parseBhpayCallback({ encryptedData: req.body.data, merchant: payout.merchant }) : null;
  const order = decrypted?.channelDebitOrderSimpleInfo || null;
  const payment = decrypted?.channelPaymentRecordSimpleInfo || decrypted?.channelPayoutRecordSimpleInfo || null;
  const processCode = order?.processCode;
  const fallbackStatus = processCode === 30 ? "success" : processCode === 40 ? "failed" : "pending";

  const result = await reconcilePayoutUpdate({
    payout,
    status: normalizeTxnStatus(fallbackStatus, payout.status),
    amount: order?.fiatAmount ?? req.query.amount,
    mobile: payout.mobile,
    utr: payment?.utr || req.query.utr,
    redirectUrl: req.query.redirect_url,
    notifyMerchant: true,
  });

  if (result.ignored) {
    return res.json({ message: "Payout callback ignored", status: result.status });
  }

  res.json({ message: "Payout callback processed", status: result.status });
}

export async function callbackDocs(_req, res) {
  res.json({
    providerBaseUrl: getProviderBaseUrl(),
    payin: {
      method: "POST",
      endpoint: "/callbacks/payin",
      parameters: {
        sourceNo: "Merchant Order ID",
        data: "AES-encrypted callback payload",
      },
    },
    payout: {
      method: "POST",
      endpoint: "/callbacks/payout",
      parameters: {
        sourceNo: "Merchant Payout Order ID",
        data: "AES-encrypted callback payload",
      },
    },
  });
}
