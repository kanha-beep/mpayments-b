import { Merchant } from "../models/Merchant.js";
import { User } from "../models/User.js";
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
      authToken: "",
      payinWallet: 0,
      payoutWallet: 0,
      payoutPending: 0,
    });
  } else {
    let shouldSave = false;

    if (merchant.authToken) {
      merchant.authToken = "";
      shouldSave = true;
    }

    if (merchant.payinWallet !== 0) {
      merchant.payinWallet = 0;
      shouldSave = true;
    }

    if (merchant.payoutWallet !== 0) {
      merchant.payoutWallet = 0;
      shouldSave = true;
    }

    if (merchant.payoutPending !== 0) {
      merchant.payoutPending = 0;
      shouldSave = true;
    }

    if (shouldSave) {
      await merchant.save();
    }
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

  return merchant;
}
