import { Merchant } from "../models/Merchant.js";
import { PaymentLink } from "../models/PaymentLink.js";
import { PayinTransaction } from "../models/PayinTransaction.js";
import { PayoutRequest } from "../models/PayoutRequest.js";
import { Settlement } from "../models/Settlement.js";
import { User } from "../models/User.js";
import { WalletTransfer } from "../models/WalletTransfer.js";
import { MERCHANT_EMAIL, MERCHANT_ID, MERCHANT_PASSWORD, MERCHANT_TOKEN } from "../utils/constants.js";
import { hashPassword } from "../utils/security.js";

export async function seedDatabase() {
  let merchant = await Merchant.findOne({ merchantId: MERCHANT_ID });

  if (!merchant) {
    merchant = await Merchant.create({
      merchantId: MERCHANT_ID,
      name: "MpaymentsPay",
      partnerType: "Business Partner",
      email: MERCHANT_EMAIL,
      mobile: "9057915397",
      company: "MpaymentsPay Private Limited",
      passwordHash: hashPassword(MERCHANT_PASSWORD),
      apiToken: MERCHANT_TOKEN,
      authToken: "26f87fab7e03d1d9ea615b6320fa45db",
      payinWallet: -142,
      payoutWallet: 1500,
      payoutPending: 0,
    });
  }

  const existingUser = await User.findOne({ email: MERCHANT_EMAIL });
  if (!existingUser) {
    await User.create({
      name: "Monish",
      email: MERCHANT_EMAIL,
      passwordHash: hashPassword(MERCHANT_PASSWORD),
      role: "merchant_admin",
      merchant: merchant._id,
    });
  } else if (!existingUser.merchant?.equals(merchant._id)) {
    existingUser.merchant = merchant._id;
    await existingUser.save();
  }

  const hasSeedData = await PaymentLink.exists({ merchant: merchant._id });
  if (hasSeedData) {
    return merchant;
  }

  const linkDocs = await PaymentLink.insertMany([
    {
      merchant: merchant._id,
      mobile: "9057915397",
      amount: 100,
      transactionId: "s",
      utr: "",
      status: "Pending",
      deepLink: "https://crm.clockspay.com/API/make_payment.php?id=s",
      upiLink: "upi://pay?pa=craft2025@nsdlpbma&pn=QUANTAMCRAFT%20PRIVATE%20LIMITED&am=100.00&cu=INR",
      remark: "Testing payment link",
      customerName: "Alice Johnson",
      customerEmail: "alice.j@example.com",
      createdAt: new Date("2026-04-06T17:57:48.000Z"),
      updatedAt: new Date("2026-04-06T17:57:48.000Z"),
    },
    {
      merchant: merchant._id,
      mobile: "9057915397",
      amount: 100,
      transactionId: "abcd",
      utr: "629584595990",
      status: "Success",
      deepLink: "https://crm.clockspay.com/API/make_payment.php?id=abcd",
      upiLink: "upi://pay?pa=craft2025@nsdlpbma&pn=QUANTAMCRAFT%20PRIVATE%20LIMITED&am=100.00&cu=INR",
      remark: "Customer recharge",
      customerName: "Alice Johnson",
      customerEmail: "alice.j@example.com",
      createdAt: new Date("2026-04-02T19:32:42.000Z"),
      updatedAt: new Date("2026-04-02T19:32:42.000Z"),
    },
    {
      merchant: merchant._id,
      mobile: "9988776655",
      amount: 1000,
      transactionId: "TXN100001",
      utr: "UTR123456",
      status: "Success",
      deepLink: "https://crm.clockspay.com/API/make_payment.php?id=TXN100001",
      upiLink: "upi://pay?pa=craft2025@nsdlpbma&pn=QUANTAMCRAFT%20PRIVATE%20LIMITED&am=1000.00&cu=INR",
      remark: "Collection",
      customerName: "Alice Johnson",
      customerEmail: "alice.j@example.com",
      createdAt: new Date("2026-04-01T13:26:58.000Z"),
      updatedAt: new Date("2026-04-01T13:26:58.000Z"),
    },
  ]);

  await PayinTransaction.insertMany([
    {
      merchant: merchant._id,
      mobile: "9057915397",
      utr: "",
      requestId: "s",
      amount: 100,
      charges: 0,
      gst: 0,
      credit: 0,
      callback: "",
      status: "Pending",
      paymentLink: linkDocs[0]._id,
      createdAt: new Date("2026-04-06T17:57:48.000Z"),
      updatedAt: new Date("2026-04-06T17:57:48.000Z"),
    },
    {
      merchant: merchant._id,
      mobile: "9057915397",
      utr: "629584595990",
      requestId: "abcd",
      amount: 100,
      charges: 0,
      gst: 0,
      credit: 100,
      callback: "SUCCESS",
      status: "Success",
      paymentLink: linkDocs[1]._id,
      createdAt: new Date("2026-04-02T19:32:42.000Z"),
      updatedAt: new Date("2026-04-02T19:32:42.000Z"),
    },
    {
      merchant: merchant._id,
      mobile: "9988776655",
      utr: "UTR123456",
      requestId: "TXN100001",
      amount: 1000,
      charges: 0,
      gst: 0,
      credit: 1000,
      callback: "SUCCESS",
      status: "Success",
      paymentLink: linkDocs[2]._id,
      createdAt: new Date("2026-04-01T13:26:58.000Z"),
      updatedAt: new Date("2026-04-01T13:26:58.000Z"),
    },
    {
      merchant: merchant._id,
      mobile: "8841112211",
      utr: "",
      requestId: "PEND3200",
      amount: 3200,
      charges: 0,
      gst: 0,
      credit: 0,
      callback: "",
      status: "Pending",
      createdAt: new Date("2026-04-03T11:05:02.000Z"),
      updatedAt: new Date("2026-04-03T11:05:02.000Z"),
    },
  ]);

  await PayoutRequest.insertMany([
    {
      merchant: merchant._id,
      mobile: "8951417844",
      transactionId: "TXN017751256127622",
      amount: 100,
      currentBalance: 0,
      charges: 2,
      gst: 0,
      finalBalance: 0,
      bank: "Kotak Mahindra Bank",
      accountNumber: "1812973766",
      ifscCode: "KKBK0009295",
      holderName: "Nabeel",
      debit: 0,
      remark: "NA",
      status: "Failed",
      bankutr: "",
      mode: "IMPS",
      utr: "",
      createdAt: new Date("2026-04-06T09:39:00.000Z"),
      updatedAt: new Date("2026-04-06T09:39:00.000Z"),
    },
    {
      merchant: merchant._id,
      mobile: "9876543210",
      transactionId: "PY100002",
      amount: 500,
      currentBalance: 85684.06,
      charges: 0,
      gst: 0,
      finalBalance: 85184.06,
      bank: "HDFC Bank",
      accountNumber: "123456789012",
      ifscCode: "HDFC0005678",
      holderName: "Bob Williams",
      debit: 500,
      remark: "Success payout",
      status: "Success",
      bankutr: "UTR654321",
      redirectUrl: "https://merchant.com/return",
      mode: "IMPS",
      utr: "602325042371",
      createdAt: new Date("2026-04-03T13:37:38.000Z"),
      updatedAt: new Date("2026-04-03T13:37:38.000Z"),
    },
  ]);

  await Settlement.create({
    merchant: merchant._id,
    mobile: "9876543210",
    reference: "SETL-1001",
    traceId: "TRACE-44109",
    startBal: 85684.06,
    amount: 500,
    charges: 0,
    gst: 0,
    endBal: 85184.06,
    bank: "HDFC Bank",
    debit: 500,
    remark: "Settlement completed",
    webhook: "SUCCESS",
    state: "Success",
    createdAt: new Date("2026-04-03T13:37:38.000Z"),
    updatedAt: new Date("2026-04-03T13:37:38.000Z"),
  });

  await WalletTransfer.create({
    merchant: merchant._id,
    customer: "MpaymentsPay",
    transactionType: "credit",
    openingPayin: 965,
    openingPayout: 0,
    amountCredited: 1300,
    amountDebited: 0,
    closingPayin: -335,
    closingPayout: 1300,
    createdAt: new Date("2026-04-06T10:05:00.000Z"),
    updatedAt: new Date("2026-04-06T10:05:00.000Z"),
  });

  return merchant;
}
