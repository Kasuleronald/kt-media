# What's New — This Update

## New pages (live and linked from the footer + relevant pages)
- `pages/warranty.html` — coverage periods, claim process, turnaround SLA
- `pages/corporate.html` — B2B/bulk page for schools, NGOs, government, corporate clients
- `pages/testimonials.html` — review template + Google Reviews guidance (placeholder quotes clearly marked — replace with real ones before publishing)
- `pages/trade-in.html` — trade-in program page with a working client-side value calculator
- `pages/blog.html` — 3 original starter articles (buying guide, slow-laptop troubleshooting, power surge protection)

## Shop improvements
- "Popular Bundles" section with 3 sample bundles (edit pricing/contents to match real stock)
- Direct links to Trade-In and Corporate pages from the shop toolbar
- Stock badges (in stock / low stock / pre-order) were already present — untouched

## Checkout improvements (assets/main.js)
- New **Payment Method** field: Pickup/Delivery cash, Mobile Money, Bank Transfer, Invoice
- Mobile Money instructions panel (shows your MoMo number — update the number/name in `main.js` if needed, search for "momo-instructions")
- Auto-generated **order reference** (e.g. `KT-7G3F91`) included in the WhatsApp message and CRM lead
- **Download Quote (PDF)** button — generates a one-page quotation client-side (loads jsPDF from CDN on demand, no setup needed)

## Still needs your input (not built — needs real accounts/credentials)
- **Real customer portal backend**: the portal at `pages/portal.html` is still demo data in the browser. To make logins and tickets real, you'd need a backend (e.g. Supabase or Firebase free tier) — happy to wire it up once you create an account and share the project URL/key.
- **Live Mobile Money API payments**: current flow is "pay manually, confirm via WhatsApp." Real-time MTN/Airtel MoMo collection requires a merchant/aggregator account (e.g. Flutterwave, Pesapal) — let me know if you want help integrating once you have one.
- Fill in `assets/site-config.js` with your real GA4 ID, CRM webhook, and chat provider — analytics/CRM code is already there but currently empty.

---

# Update 2 — Local mock backend + responsive/dynamic polish

## Mock backend (browser-saved, for development)
- Real multi-user accounts now live in `localStorage` (`kt_mock_users`), not just sessionStorage — they survive closing the tab/browser.
- Two seeded test logins, ready to use immediately:
  - `test@ktmedia.com` / `test1234` — individual customer (Maria K.), 3 devices, 3 tickets
  - `corporate@ktmedia.com` / `corp1234` — organization account (Kampala Junior School), corporate plan, its own devices/tickets
- A working **sign-up form** on the login page lets you create more test accounts on the fly (toggle "New here? Create a free test account").
- Logging in is now real: wrong email/password is rejected with a message; each account only sees its own devices and tickets.
- "Report New Issue" tickets are saved to that specific account's record, so they're still there next time that test user logs in — even after closing the browser.
- Logout only clears the session pointer; the account's data stays saved for next time.
- Devices now carry a purchase date + warranty length, so "My Devices" shows a live "warranty ends in X days" countdown.
- Portal overview now greets you by name with a time-of-day greeting ("Good morning, Maria") and the Recent Activity panel is now actually populated.

## More dynamic
- Blocking `alert()` popups in checkout/login replaced with non-blocking toast notifications.
- The mobile floating cart button now shows a live running total next to it, not just an item count.

## More responsive
- Reviewed all new sections against existing breakpoints (640/860/900px) — they reuse the site's existing responsive grid/card/form components, so they collapse correctly on mobile without extra work.
- Mobile floating cart total pill, modal button stacking, and table horizontal-scroll were double-checked on small screens.

## Still needs your input
- This is still a local mock backend — open the same account in a different browser or device and it won't see the same data, since it's not on a real server yet. Swap to Supabase/Firebase when ready and I can wire it in.
