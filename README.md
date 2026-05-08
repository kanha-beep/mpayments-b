# Payment Dashboard API

This server is a Mongo-ready Express API for a merchant payment dashboard.

Current behavior:
- serves merchant dashboard summaries
- creates payment links
- lists payin transaction status
- creates payout requests
- updates payout status and generates settlement entries
- lists wallet transfer and profile data
- stores data in memory by default

Mongo support:
- set MONGO_URI before starting the server
- the connection is initialized, but this scaffold still uses the in-memory store for reads and writes
- next step can be moving the store helpers to real Mongoose models

Main endpoints:
- GET /api/health
- GET /api/dashboard
- GET /api/merchants
- GET /api/payment-links
- POST /api/payment-links
- GET /api/payin-status
- GET /api/payout-requests
- POST /api/payout-requests
- PATCH /api/payout-requests/:requestId/status
- GET /api/settlement-report
- GET /api/wallet-report
- GET /api/profile
- PATCH /api/profile
- GET /api/api-documents
- PUT /api/api-documents/webhooks

Merchant resolution:
- query param: merchantId
- or header: x-merchant-id
- defaults to the seeded merchant in src/data.js
"# mpayments-b" 
"# mpayments-b" 
