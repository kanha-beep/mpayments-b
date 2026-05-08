import { Router } from "express";
import {
  createPaymentLinkInternal,
  createPayoutRequestInternal,
  getApiDocumentsInternal,
  getDashboard,
  getPaymentLinks,
  getPayinStatus,
  getPayoutRequests,
  getProfileInternal,
  getSettlementReport,
  getWalletReport,
  regenerateApiTokenInternal,
  refreshPayinStatusInternal,
  syncWalletBalanceInternal,
  updateApiDocumentsInternal,
  updatePayoutStatusInternal,
  updateProfileInternal,
} from "../controllers/internalController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/dashboard", getDashboard);
router.get("/payment-links", getPaymentLinks);
router.post("/payment-links", createPaymentLinkInternal);
router.get("/payin-status", getPayinStatus);
router.post("/payin-status/:requestId/refresh", refreshPayinStatusInternal);
router.get("/payout-requests", getPayoutRequests);
router.post("/payout-requests", createPayoutRequestInternal);
router.patch("/payout-requests/:requestId/status", updatePayoutStatusInternal);
router.post("/wallet/sync", syncWalletBalanceInternal);
router.get("/settlement-report", getSettlementReport);
router.get("/wallet-report", getWalletReport);
router.get("/profile", getProfileInternal);
router.patch("/profile", updateProfileInternal);
router.get("/api-documents", getApiDocumentsInternal);
router.put("/api-documents/webhooks", updateApiDocumentsInternal);
router.post("/api-documents/regenerate-token", regenerateApiTokenInternal);

export default router;
