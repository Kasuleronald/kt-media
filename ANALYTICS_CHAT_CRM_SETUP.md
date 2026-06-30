# Analytics, Chat, and CRM Setup Guide

This project now supports GA4, Matomo, live chat, and CRM webhooks through one config file.

## 1) Configure integrations

Open:
- assets/site-config.js

Fill these fields:
- analytics.ga4MeasurementId
- analytics.matomoUrl
- analytics.matomoSiteId
- crm.webhookUrl
- crm.authToken (optional)
- chat.provider
- chat.tawkPropertyId and chat.tawkWidgetId (for Tawk)
- chat.crispWebsiteId (for Crisp)

### Provider options
- chat.provider = custom
  - Uses built-in live chat widget and sends leads to CRM webhook.
- chat.provider = tawk
  - Loads Tawk widget directly.
- chat.provider = crisp
  - Loads Crisp widget directly.

## 2) Conversion dashboard location

Open:
- pages/portal.html

Sign in to demo portal and open the Analytics tab in the left sidebar.

Dashboard metrics include:
- Page Views
- Product Views
- Add to Cart
- Checkout Starts
- Orders
- Leads
- Step conversion rates
- CRM webhook sent/failed/queued counts

## 3) CRM webhook payload format

Webhook receives JSON with this structure:
- type
- source
- page
- at
- data

Example types currently sent:
- contact_form
- order_submit
- chat_lead
- ticket_submit

If webhook is unavailable, leads are queued in localStorage under kt_webhook_queue and retried automatically.

## 4) Validation checklist

- Open browser dev tools network tab.
- Trigger a page visit, product view, add-to-cart, checkout, and lead submit.
- Confirm requests appear for:
  - googletagmanager.com (GA4)
  - your Matomo endpoint
  - your CRM webhook URL
- Open portal Analytics tab and confirm counters increase.

## 5) Security notes

- If you use crm.authToken, rotate it periodically.
- Prefer a server-side webhook proxy for production if you need stricter secrets handling.
- Add webhook-side validation and rate limiting.
