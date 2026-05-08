import crypto from "crypto";
import { PaymentLink } from "../models/PaymentLink.js";
import { Settlement } from "../models/Settlement.js";
import { WalletTransfer } from "../models/WalletTransfer.js";

function toAmount(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

export function normalizeTxnStatus(status, fallback = "Pending") {
  if (!status) return fallback;

  const normalized = `${status}`.trim().toLowerCase();
  if (normalized === "success" || normalized === "successful") return "Success";
  if (normalized === "failed" || normalized === "failure") return "Failed";
  if (normalized === "pending" || normalized === "unknown" || normalized === "processing") return "Pending";
  return fallback;
}

async function createWalletTransferForPayin(merchant, transaction, creditedAmount) {
  await WalletTransfer.create({
    merchant: merchant._id,
    customer: merchant.name,
    transactionType: "credit",
    openingPayin: merchant.payinWallet - creditedAmount,
    openingPayout: merchant.payoutWallet,
    amountCredited: creditedAmount,
    amountDebited: 0,
    closingPayin: merchant.payinWallet,
    closingPayout: merchant.payoutWallet,
  });
}

async function createSettlementForPayout(merchant, payout) {
  const reference = `SETL-${payout.transactionId}`;
  const existing = await Settlement.findOne({ merchant: merchant._id, reference });
  if (existing) return;

  await Settlement.create({
    merchant: merchant._id,
    mobile: payout.mobile,
    reference,
    traceId: `TRACE-${crypto.randomInt(10000, 99999)}`,
    startBal: payout.currentBalance,
    amount: payout.amount,
    charges: payout.charges,
    gst: payout.gst,
    endBal: merchant.payoutWallet,
    bank: payout.bank,
    debit: payout.amount,
    remark: "Settlement completed",
    webhook: "SUCCESS",
    state: "Success",
  });

  await WalletTransfer.create({
    merchant: merchant._id,
    customer: merchant.name,
    transactionType: "debit",
    openingPayin: merchant.payinWallet,
    openingPayout: merchant.payoutWallet + payout.amount,
    amountCredited: 0,
    amountDebited: payout.amount,
    closingPayin: merchant.payinWallet,
    closingPayout: merchant.payoutWallet,
  });
}

async function postMerchantCallback(url, payload) {
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(`Merchant callback failed for ${url}:`, error.message);
  }
}

export async function reconcilePayinUpdate({
  merchant,
  transaction,
  status,
  amount,
  mobile,
  utr,
  callbackState,
  notifyMerchant = false,
}) {
  const resolvedMerchant = merchant || transaction.merchant;
  const previousStatus = transaction.status;
  const nextStatus = normalizeTxnStatus(status, previousStatus);

  if (previousStatus === "Success" && nextStatus !== "Success") {
    return { ignored: true, status: transaction.status };
  }

  const creditedAmount = toAmount(amount, transaction.amount);
  transaction.status = nextStatus;
  transaction.mobile = mobile || transaction.mobile;
  transaction.utr = utr || transaction.utr;
  if (callbackState) {
    transaction.callback = callbackState;
  }

  const paymentLink = await PaymentLink.findOne({
    merchant: resolvedMerchant._id,
    transactionId: transaction.requestId,
  });

  if (paymentLink) {
    paymentLink.status = transaction.status;
    paymentLink.utr = transaction.utr;
    await paymentLink.save();
  }

  if (previousStatus !== "Success" && transaction.status === "Success" && transaction.credit === 0) {
    transaction.credit = creditedAmount;
    resolvedMerchant.payinWallet += creditedAmount;
    await resolvedMerchant.save();
    await createWalletTransferForPayin(resolvedMerchant, transaction, creditedAmount);
  }

  await transaction.save();

  if (notifyMerchant && resolvedMerchant.payinCallbackUrl) {
    await postMerchantCallback(resolvedMerchant.payinCallbackUrl, {
      event: "payin.status.updated",
      orderId: transaction.requestId,
      status: transaction.status,
      amount: creditedAmount,
      mobile: transaction.mobile,
      utr: transaction.utr,
      callback: transaction.callback,
    });
  }

  return { ignored: false, status: transaction.status };
}

export async function reconcilePayoutUpdate({
  merchant,
  payout,
  status,
  amount,
  mobile,
  utr,
  redirectUrl,
  notifyMerchant = false,
}) {
  const resolvedMerchant = merchant || payout.merchant;
  const previousStatus = payout.status;
  const nextStatus = normalizeTxnStatus(status, previousStatus);

  if (previousStatus === "Success" && nextStatus !== "Success") {
    return { ignored: true, status: payout.status };
  }

  payout.status = nextStatus;
  payout.mobile = mobile || payout.mobile;
  payout.bankutr = utr || payout.bankutr;
  payout.redirectUrl = redirectUrl || payout.redirectUrl;

  if (previousStatus !== "Success" && payout.status === "Success") {
    payout.debit = toAmount(amount, payout.amount);
    payout.finalBalance = Math.max(payout.currentBalance - payout.amount, 0);
    resolvedMerchant.payoutPending = Math.max(resolvedMerchant.payoutPending - payout.amount, 0);
    resolvedMerchant.payoutWallet = Number((resolvedMerchant.payoutWallet - payout.amount).toFixed(2));
    await resolvedMerchant.save();
    await createSettlementForPayout(resolvedMerchant, payout);
  }

  if (previousStatus === "Pending" && payout.status === "Failed") {
    resolvedMerchant.payoutPending = Math.max(resolvedMerchant.payoutPending - payout.amount, 0);
    await resolvedMerchant.save();
  }

  await payout.save();

  if (notifyMerchant && resolvedMerchant.payoutCallbackUrl) {
    await postMerchantCallback(resolvedMerchant.payoutCallbackUrl, {
      event: "payout.status.updated",
      orderId: payout.transactionId,
      status: payout.status,
      amount: payout.amount,
      mobile: payout.mobile,
      utr: payout.bankutr,
      redirectUrl: payout.redirectUrl,
    });
  }

  return { ignored: false, status: payout.status };
}
