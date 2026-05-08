import { Router } from "express";
import {
  callbackDocs,
  createLinkApi,
  orderStatusApi,
  payoutRequestApi,
  receivePayinCallback,
  receivePayoutCallback,
  walletFetchApi,
} from "../controllers/externalApiController.js";

const router = Router();

router.post("/create_link.php", createLinkApi);
router.post("/order_status.php", orderStatusApi);
router.post("/payout-request.php", payoutRequestApi);
router.post("/wallet-fetch.php", walletFetchApi);
router.post("/callbacks/payin", receivePayinCallback);
router.post("/callbacks/payout", receivePayoutCallback);
router.get("/callbacks/payin", receivePayinCallback);
router.get("/callbacks/payout", receivePayoutCallback);
router.get("/docs/callbacks", callbackDocs);

export default router;
