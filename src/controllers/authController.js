import { Merchant } from "../models/Merchant.js";
import { User } from "../models/User.js";
import { MERCHANT_EMAIL, MERCHANT_PASSWORD } from "../utils/constants.js";
import { createSessionToken, hashPassword, signPayload, verifyPassword } from "../utils/security.js";

export async function login(req, res) {
  const { email = MERCHANT_EMAIL, password = MERCHANT_PASSWORD } = req.body;
  const user = await User.findOne({ email }).populate("merchant");

  if (user) {
    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.sessionToken = createSessionToken();
    await user.save();

    const merchant = user.merchant;
    const token = signPayload({
      userId: user._id.toString(),
      merchantId: merchant.merchantId,
      sessionToken: user.sessionToken,
    });

    return res.json({
      token,
      merchant: {
        merchantId: merchant.merchantId,
        name: merchant.name,
        email: merchant.email,
        apiToken: merchant.apiToken,
      },
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  const merchant = await Merchant.findOne({ email });
  if (!merchant || !verifyPassword(password, merchant.passwordHash)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  merchant.sessionToken = createSessionToken();
  await merchant.save();
  const token = signPayload({ merchantId: merchant.merchantId, sessionToken: merchant.sessionToken });

  res.json({
    token,
    merchant: {
      merchantId: merchant.merchantId,
      name: merchant.name,
      email: merchant.email,
      apiToken: merchant.apiToken,
    },
  });
}

export async function me(req, res) {
  res.json({
    user: req.user
      ? {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        }
      : null,
    merchantId: req.merchant.merchantId,
    name: req.merchant.name,
    email: req.merchant.email,
    apiToken: req.merchant.apiToken,
  });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const account = req.user || req.merchant;

  if (!verifyPassword(currentPassword, account.passwordHash)) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  account.passwordHash = hashPassword(newPassword);
  await account.save();
  res.json({ message: "Password updated" });
}
