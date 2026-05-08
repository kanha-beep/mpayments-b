import { PaymentLink } from "../models/PaymentLink.js";
import { PayinTransaction } from "../models/PayinTransaction.js";
import { PayoutRequest } from "../models/PayoutRequest.js";
import { Settlement } from "../models/Settlement.js";
import { WalletTransfer } from "../models/WalletTransfer.js";
import {
  createProviderPaymentLink,
  createProviderPayout,
  fetchProviderOrderStatus,
  fetchProviderWallet,
} from "../services/providerService.js";
import {
  normalizeTxnStatus,
  reconcilePayinUpdate,
  reconcilePayoutUpdate,
} from "../services/transactionFlowService.js";
import { formatCurrency, formatDateTime, isDemoMerchantSetup } from "../utils/constants.js";
import { createApiToken } from "../utils/security.js";

function buildMetric(label, value) {
  return { label, value };
}

export async function getDashboard(req, res) {
  const merchant = req.merchant;
  const payins = await PayinTransaction.find({ merchant: merchant._id }).lean();
  const payouts = await PayoutRequest.find({ merchant: merchant._id }).lean();
  const sumByStatus = (items, status) => items.filter((item) => item.status === status).reduce((sum, item) => sum + item.amount, 0);
  const payinAttempt = payins.reduce((sum, item) => sum + item.amount, 0);
  const payoutAttempt = payouts.reduce((sum, item) => sum + item.amount, 0);

  res.json({
    merchant: { name: merchant.name, email: merchant.email, mobile: merchant.mobile, company: merchant.company },
    walletCards: [
      { id: 1, label: "Pay-in Wallet", value: formatCurrency(merchant.payinWallet) },
      { id: 2, label: "Pay-out Wallet", value: formatCurrency(merchant.payoutWallet) },
      { id: 3, label: "Pay-out Pending", value: formatCurrency(merchant.payoutPending) },
    ],
    metrics: [
      buildMetric("TOTAL ATTEMPT", formatCurrency(payinAttempt)),
      buildMetric("SUCCESS PAY-INS", formatCurrency(sumByStatus(payins, "Success"))),
      buildMetric("PENDING PAY-INS", formatCurrency(sumByStatus(payins, "Pending"))),
      buildMetric("FAILED PAY-INS", formatCurrency(sumByStatus(payins, "Failed"))),
      buildMetric("TOTAL ATTEMPT", formatCurrency(payoutAttempt)),
      buildMetric("SUCCESSFUL PAYOUTS", formatCurrency(sumByStatus(payouts, "Success"))),
      buildMetric("PENDING PAYOUTS", formatCurrency(sumByStatus(payouts, "Pending"))),
      buildMetric("FAILED PAYOUTS", formatCurrency(sumByStatus(payouts, "Failed"))),
    ],
  });
}

export async function getPaymentLinks(req, res) {
  const rows = await PaymentLink.find({ merchant: req.merchant._id }).sort({ createdAt: -1 }).lean();
  res.json(rows.map((item) => ({
    id: item._id,
    mobile: item.mobile,
    amount: formatCurrency(item.amount),
    transactionId: item.transactionId,
    utr: item.utr,
    status: item.status,
    deepLink: item.deepLink,
    upiLink: item.upiLink,
    date: formatDateTime(item.createdAt),
  })));
}

export async function createPaymentLinkInternal(req, res) {
  const merchant = req.merchant;
  const amount = Number(req.body.amount);
  const transactionId = (req.body.transactionId || `TXN${Date.now()}`).trim();
  const mobile = req.body.mobile || merchant.mobile;

  if (!transactionId) {
    return res.status(400).json({ message: "Transaction ID is required" });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Enter a valid amount" });
  }

  const upstream = await createProviderPaymentLink({
    merchant,
    transactionId,
    amount,
    callbackUrl: merchant.payinCallbackUrl || undefined,
    payerAccountDetailList: req.body.payerAccountDetailList,
  });

  if (!upstream.ok || upstream.data?.error === true) {
    return res.status(400).json({
      message: upstream.data?.message || "Payment link not generated",
      provider: upstream.data,
    });
  }

  const paymentLink = await PaymentLink.create({
    merchant: merchant._id,
    mobile,
    amount,
    transactionId,
    status: "Pending",
    deepLink: upstream.data.paymentLink,
    upiLink: upstream.data.upiLink || "",
    customerName: req.body.name || merchant.name,
    customerEmail: req.body.email || merchant.email,
  });

  await PayinTransaction.create({
    merchant: merchant._id,
    mobile,
    requestId: transactionId,
    amount,
    paymentLink: paymentLink._id,
    status: "Pending",
  });

  res.status(201).json({
    id: paymentLink._id,
    mobile: paymentLink.mobile,
    amount: formatCurrency(paymentLink.amount),
    transactionId: paymentLink.transactionId,
    status: paymentLink.status,
    deepLink: paymentLink.deepLink,
    upiLink: paymentLink.upiLink,
    date: formatDateTime(paymentLink.createdAt),
  });
}

export async function getPayinStatus(req, res) {
  const rows = await PayinTransaction.find({ merchant: req.merchant._id }).sort({ createdAt: -1 }).lean();
  const successAmount = rows.filter((item) => item.status === "Success").reduce((sum, item) => sum + item.amount, 0);
  const charges = rows.reduce((sum, item) => sum + item.charges, 0);
  res.json({
    summary: { amount: formatCurrency(successAmount), charges: formatCurrency(charges) },
    rows: rows.map((item, index) => ({
      id: item._id,
      index: String(index + 1),
      mobile: item.mobile,
      utr: item.utr,
      dateTime: formatDateTime(item.createdAt),
      requestId: item.requestId,
      amount: formatCurrency(item.amount),
      charges: formatCurrency(item.charges),
      gst: formatCurrency(item.gst),
      credit: formatCurrency(item.credit),
      callback: item.callback,
      status: item.status,
    })),
  });
}

export async function refreshPayinStatusInternal(req, res) {
  const tx = await PayinTransaction.findOne({ _id: req.params.requestId, merchant: req.merchant._id });
  if (!tx) return res.status(404).json({ message: "Payin transaction not found" });

  const upstream = await fetchProviderOrderStatus({ merchant: req.merchant, type: "payin", transactionId: tx.requestId });
  const status = upstream.data?.txn_status;
  if (status) {
    await reconcilePayinUpdate({
      merchant: req.merchant,
      transaction: tx,
      status,
      amount: upstream.data.amount,
      mobile: upstream.data.mobile,
      utr: upstream.data.utr,
      callbackState: upstream.data.callback || "POLLED",
    });
  }
  res.json(upstream.data);
}

export async function getPayoutRequests(req, res) {
  const rows = await PayoutRequest.find({ merchant: req.merchant._id }).sort({ createdAt: -1 }).lean();
  res.json(rows.map((item, index) => ({
    id: item._id,
    index: String(index + 1),
    mobile: item.mobile,
    utr: item.utr,
    dateTime: formatDateTime(item.createdAt),
    transactionId: item.transactionId,
    currentBalance: formatCurrency(item.currentBalance),
    amount: formatCurrency(item.amount),
    charges: String(item.charges),
    gst: String(item.gst),
    finalBalance: formatCurrency(item.finalBalance),
    bank: `Bank: ${item.bank}`,
    debit: String(item.debit),
    remark: item.remark,
    status: item.status,
  })));
}

export async function createPayoutRequestInternal(req, res) {
  const merchant = req.merchant;
  const amount = Number(req.body.amount);
  const transactionId = req.body.transactionId || `PY${Date.now()}`;
  const mobile = req.body.mobile || merchant.mobile;

  if (amount > merchant.payoutWallet) {
    return res.status(400).json({ message: "Insufficient payout wallet balance" });
  }

  const upstream = await createProviderPayout({
    merchant,
    transactionId,
    amount,
    callbackUrl: merchant.payoutCallbackUrl || undefined,
    payeeAccountDetail: {
      accountName: req.body.holderName || req.body.customerName || merchant.name,
      bankNo: req.body.ifscCode,
      bankAccount: req.body.accountNumber,
      bankName: req.body.bank,
      accountType: req.body.mode === "UPI" ? "2" : "1",
      mobile,
    },
  });

  if (upstream.data?.status !== "success") {
    return res.status(400).json(upstream.data);
  }

  const doc = await PayoutRequest.create({
    merchant: merchant._id,
    mobile,
    transactionId,
    amount,
    currentBalance: merchant.payoutWallet,
    charges: 2,
    finalBalance: Math.max(merchant.payoutWallet - amount, 0),
    bank: req.body.bank,
    accountNumber: req.body.accountNumber,
    ifscCode: req.body.ifscCode,
    holderName: req.body.holderName,
    debit: amount,
    remark: req.body.customerName || "Wallet request created",
    status: "Pending",
    mode: req.body.mode || "IMPS",
  });

  merchant.payoutPending += amount;
  await merchant.save();

  res.status(201).json(doc);
}

export async function updatePayoutStatusInternal(req, res) {
  const merchant = req.merchant;
  const payout = await PayoutRequest.findOne({ _id: req.params.requestId, merchant: merchant._id });
  if (!payout) return res.status(404).json({ message: "Payout request not found" });

  const upstream = await fetchProviderOrderStatus({ merchant, type: "payout", transactionId: payout.transactionId });
  const nextStatus = upstream.data?.txn_status
    ? normalizeTxnStatus(upstream.data.txn_status, payout.status)
    : normalizeTxnStatus(req.body.status, payout.status);

  await reconcilePayoutUpdate({
    merchant,
    payout,
    status: nextStatus,
    amount: upstream.data?.amount,
    mobile: upstream.data?.mobile,
    utr: upstream.data?.bankutr || payout.bankutr || `UTR${Math.floor(Math.random() * 900000)}`,
    redirectUrl: upstream.data?.redirect_url,
  });

  res.json({ message: "Payout status updated", provider: upstream.data });
}

export async function syncWalletBalanceInternal(req, res) {
  const upstream = await fetchProviderWallet({ merchant: req.merchant });
  if (upstream.data?.status === "success" && upstream.data.wallet_balance !== undefined) {
    req.merchant.payoutWallet = Number(upstream.data.wallet_balance);
    req.merchant.payoutPending = Number(upstream.data.frozen_balance || req.merchant.payoutPending || 0);
    await req.merchant.save();
  }
  res.json(upstream.data);
}

export async function getSettlementReport(req, res) {
  const rows = await Settlement.find({ merchant: req.merchant._id }).sort({ createdAt: -1 }).lean();
  const amount = rows.reduce((sum, item) => sum + item.amount, 0);
  const charges = rows.reduce((sum, item) => sum + item.charges, 0);
  res.json({
    summary: { amount: formatCurrency(amount), charges: formatCurrency(charges) },
    rows: rows.map((item, index) => ({
      id: item._id,
      index: String(index + 1),
      mobile: item.mobile,
      reference: item.reference,
      timestamp: formatDateTime(item.createdAt),
      traceId: item.traceId,
      startBal: formatCurrency(item.startBal),
      amount: formatCurrency(item.amount),
      charges: formatCurrency(item.charges),
      gst: formatCurrency(item.gst),
      endBal: formatCurrency(item.endBal),
      bank: item.bank,
      debit: formatCurrency(item.debit),
      remark: item.remark,
      webhook: item.webhook,
      state: item.state,
    })),
  });
}

export async function getWalletReport(req, res) {
  const rows = await WalletTransfer.find({ merchant: req.merchant._id }).sort({ createdAt: -1 }).lean();
  res.json(rows.map((item, index) => ({
    id: item._id,
    serial: String(index + 1),
    customer: item.customer,
    transactionType: item.transactionType,
    openingPayin: formatCurrency(item.openingPayin),
    openingPayout: formatCurrency(item.openingPayout),
    amountCredited: formatCurrency(item.amountCredited),
    amountDebited: formatCurrency(item.amountDebited),
    closingPayin: formatCurrency(item.closingPayin),
    closingPayout: formatCurrency(item.closingPayout),
  })));
}

export async function getProfileInternal(req, res) {
  res.json({
    merchantId: req.merchant.merchantId,
    name: req.merchant.name,
    partnerType: req.merchant.partnerType,
    email: req.merchant.email,
    mobile: req.merchant.mobile,
    company: req.merchant.company,
  });
}

export async function updateProfileInternal(req, res) {
  Object.assign(req.merchant, req.body);
  await req.merchant.save();
  res.json({ message: "Profile updated" });
}

export async function getApiDocumentsInternal(req, res) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const createLinkEndpoint = `${baseUrl}/API/create_link.php`;
  const orderStatusEndpoint = `${baseUrl}/API/order_status.php`;
  const payoutEndpoint = `${baseUrl}/API/payout-request.php`;
  const walletEndpoint = `${baseUrl}/API/wallet-fetch.php`;
  const payinCallbackEndpoint = `${baseUrl}/API/callbacks/payin`;
  const payoutCallbackEndpoint = `${baseUrl}/API/callbacks/payout`;

  res.json({
    token: req.merchant.apiToken,
    merchantToken: req.merchant.apiToken,
    payinCallbackUrl: req.merchant.payinCallbackUrl,
    payoutCallbackUrl: req.merchant.payoutCallbackUrl,
    createLinkEndpoint,
    orderStatusEndpoint,
    payoutEndpoint,
    walletEndpoint,
    payinCallbackEndpoint,
    payoutCallbackEndpoint,
    routeType: "Express route",
    isDemoSetup: isDemoMerchantSetup(),
    configurationNote: isDemoMerchantSetup()
      ? "Demo merchant credentials are loaded from seed defaults. Replace them with environment variables for production use."
      : "Merchant credentials are coming from your configured environment/database values.",
    productName: "MpaymentsPay",
    providerBaseUrl: "https://api.bharatpay.cc",
    providerTestBaseUrl: "https://api-beta.bharatpay.cc",
    panelLinks: [],
    payload: "",
    docs: {
      overview: {
        title: "BharatPay Merchant API Overview",
        notes: [
          "Merchant dashboard link, username, and password are issued by the operations team.",
          "Login IPs and Auth IPs must be whitelisted before using the dashboard or API.",
          "AccessKey is generated from the merchant dashboard and should be stored securely.",
          "Before production go-live, reapply AccessKey and complete whitelist/callback verification.",
        ],
      },
      authAndEncryption: {
        title: "Authentication And Encryption",
        method: "POST",
        contentType: "application/json",
        payload: {
          sourceNo: "merchant-order-no",
          data: "AES-ECB-PKCS7-Base64 encrypted payload",
        },
        successResponse: {
          headers: {
            "Content-Type": "application/json",
            Authorization: "{MerchantID}",
          },
          aes: {
            mode: "ECB",
            padding: "PKCS7",
            keyLength: "256 bits",
            key: "Same as AccessKey",
            charset: "UTF-8",
            output: "Base64",
          },
        },
        notes: [
          "V2 requests use header Authorization: {MerchantID}.",
          "The business payload is sent in the encrypted data field.",
          "AES key is the same value as the merchant AccessKey.",
          "This dashboard backend is already wired to BharatPay V2 request format; live usage now depends on real MerchantID, AccessKey, callback URL, and whitelist setup.",
        ],
      },
      environments: {
        title: "Environments",
        successResponse: {
          testEndpoint: "https://api-beta.bharatpay.cc",
          productionEndpoint: "https://api.bharatpay.cc",
          docsUrl: "https://doc-en.bharatpay.cc/",
        },
        notes: [
          "Production dashboard link is issued separately by operations before go-live.",
          "Complete AccessKey regeneration, callback verification, and Auth IP whitelist before switching to production.",
        ],
      },
      createLink: {
        title: "Collection Interface V2",
        method: "POST",
        endpoint: "https://api-beta.bharatpay.cc/api/channel/Credit/Place",
        payload: {
          sourceNo: "merchant-order-no",
          data: "AES encrypted collection order details",
        },
        successResponse: {
          httpCode: 200,
          contentType: "text/plain",
          note: "Success is judged from the response object / process code in BharatPay docs.",
        },
        failedResponse: {
          httpCode: "non-200 or provider business failure",
          note: "Refer to BharatPay process codes and response object for exact failure mapping.",
        },
        notes: [
          "V1 collection set/get/process endpoints exist but the docs say V1 may be removed in the future.",
          "V2 uses encrypted payload in the data field.",
          "The collection callback decrypts to channelCreditOrderSimpleInfo-related data.",
        ],
        curl: `curl -X POST https://api-beta.bharatpay.cc/api/channel/Credit/Place \\
-H "Content-Type: application/json" \\
-H "Authorization: {MerchantID}" \\
-d '${JSON.stringify(
          {
            sourceNo: "merchant-order-no",
            data: "AES encrypted collection order details",
          },
          null,
          2,
        )}'`,
      },
      payinStatus: {
        title: "Collection Query V2",
        method: "POST",
        endpoint: "https://api-beta.bharatpay.cc/api/channel/Credit/GetV2",
        payload: {
          sourceNo: "merchant-order-no",
          data: "AES encrypted query details",
        },
        successResponse: {
          httpCode: 200,
          note: "Use the returned BharatPay response object/process code to judge final status.",
        },
        notes: [
          "The docs also expose V1 query at /api/channel/Credit/Get.",
          "Callback data for collection uses the encrypted query response object.",
        ],
      },
      payinCallback: {
        title: "Callback Instructions",
        method: "POST",
        contentType: "AES encrypted JSON string",
        callbackUrl: req.merchant.payinCallbackUrl || "https://merchant.com/payin-callback",
        providerCallbackEndpoint: payinCallbackEndpoint,
        parameters: {
          channelCreditOrderSimpleInfo: "collection callback object",
          channelDebitOrderSimpleInfo: "payout callback object",
          channelPaymentRecordSimpleInfo: "payment record object",
        },
        sampleUrl: "Encrypted POST body from BharatPay to your callback URL",
        notes: [
          "Only successful or failed orders trigger callbacks.",
          "If callback URL is not set per order, the dashboard default callback URL is used.",
          "Callback source IP documented by BharatPay: 65.20.91.228.",
          "Your callback endpoint must return HTTP 200 or BharatPay will treat it as failed and retry up to 3 times.",
        ],
      },
      payoutRequest: {
        title: "Payout Interface",
        method: "POST",
        endpoint: "https://api-beta.bharatpay.cc/api/channel/Debit/Place",
        payload: {
          sourceNo: "merchant-payout-order-no",
          data: "AES encrypted payout details",
        },
        successResponse: {
          note: "Payout callback decrypts to channelDebitOrderSimpleInfo and channelPaymentRecordSimpleInfo objects.",
        },
        notes: [
          "The BharatPay README confirms payout callback structure and environment/authentication rules.",
          "Use the official payout interface page for the exact debit endpoint list before implementation.",
        ],
      },
      payoutStatus: {
        title: "Payout Query V2",
        method: "POST",
        endpoint: "https://api-beta.bharatpay.cc/api/channel/Debit/GetV2",
        payload: {
          sourceNo: "merchant-payout-order-no",
          data: "AES encrypted payout query details",
        },
        successResponse: {
          httpCode: 200,
          note: "Payout success = processCode 30, failed = 40, reversal = 50.",
        },
      },
      payoutCallback: {
        title: "Dashboard Setup Notes",
        method: "Merchant Dashboard",
        contentType: "Operations controlled setup",
        callbackUrl: req.merchant.payoutCallbackUrl || "https://merchant.com/payout-callback",
        providerCallbackEndpoint: payoutCallbackEndpoint,
        parameters: {
          dashboardLink: "Issued by operations team",
          username: "Issued by operations team",
          password: "Issued by operations team",
          accessKey: "Regenerated inside API settings",
        },
        sampleUrl: "Operations team provides merchant dashboard access and whitelisting before go-live",
        notes: [
          "Ask operations to whitelist login IPs and Auth IPs.",
          "Google Authenticator verification is required during AccessKey changes.",
          "If callback URL validation is enabled in the dashboard, make sure your endpoint returns HTTP 200 for the dashboard test request.",
        ],
      },
      walletFetch: {
        title: "Merchant Balance",
        method: "GET",
        endpoint: "https://api-beta.bharatpay.cc/api/channel/Merchant/Balance",
        successResponse: {
          balance: "Total balance",
          frozenBalance: "Frozen balance",
          remainBalance: "Available balance",
        },
        notes: [
          "This dashboard now maps wallet sync to BharatPay merchant balance.",
          "Available balance maps to payout wallet and frozen balance maps to payout pending.",
          "Merchant-facing apiToken stays separate from BharatPay credentials; your clients use apiToken on MpaymentsPay endpoints while the server uses MerchantID and AccessKey when calling BharatPay.",
        ],
      },
    },
  });
}

export async function updateApiDocumentsInternal(req, res) {
  req.merchant.payinCallbackUrl = req.body.payinCallbackUrl ?? req.merchant.payinCallbackUrl;
  req.merchant.payoutCallbackUrl = req.body.payoutCallbackUrl ?? req.merchant.payoutCallbackUrl;
  await req.merchant.save();
  res.json({ message: "Webhook URLs updated" });
}

export async function regenerateApiTokenInternal(req, res) {
  let nextToken = createApiToken();

  while (await req.merchant.constructor.exists({ apiToken: nextToken, _id: { $ne: req.merchant._id } })) {
    nextToken = createApiToken();
  }

  req.merchant.apiToken = nextToken;
  await req.merchant.save();

  res.json({
    message: "Merchant API token regenerated",
    apiToken: req.merchant.apiToken,
  });
}
