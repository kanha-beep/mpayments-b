import { Merchant } from "../models/Merchant.js";
import { User } from "../models/User.js";
import { verifySignedToken } from "../utils/security.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;
    const apiToken = req.headers["x-api-token"];

    let merchant = null;
    let user = null;

    if (bearerToken) {
      const payload = verifySignedToken(bearerToken);
      if (payload?.sessionToken) {
        user = await User.findOne({ sessionToken: payload.sessionToken }).populate("merchant");
        if (user?.merchant) {
          merchant = user.merchant;
        } else {
          merchant = await Merchant.findOne({ sessionToken: payload.sessionToken });
        }
      }
    }

    if (!merchant && apiToken) {
      merchant = await Merchant.findOne({ apiToken });
    }

    if (!merchant) {
      return next(Object.assign(new Error("Unauthorized"), { status: 401 }));
    }

    req.merchant = merchant;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
