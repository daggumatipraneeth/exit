# QA report: full-site end-to-end test

**Date:** 2026-10-13 (IST)
**Target:** local Supabase stack, reset from scratch (`supabase db reset`, migrations 01–20 plus seed). The two new migrations were applied in place during the run.
**App:** Vite dev server at http://localhost:5173

**Tools:**
- **Playwright MCP** drove the main run. It used six isolated browser contexts: admin, partner, anonymous signer, and three customers.
- **Claude in Chrome** was the second admin session, used for the concurrency test.
- **Independent payout simulator:** `sim.mjs` (scratchpad), a re-implementation of the payout rules written from the spec. It reads the raw entries and capital from the DB and diffs every customer-day and partner-day the app computed.

**Screenshots:** `docs/qa-screenshots/`

## Result summary
| | |
|---|---|
| Pages and areas touched | **All**: 8 public sections, 17 portal routes, 4 roles × 16 routes |
| Money checks (simulator vs app) | **692 rows, 0 mismatches**: Aug 94, Sep+Oct 470, Oct after edits 128 |
| Settlements and payout CSVs | Aug and Sep match expected **to the paisa** |
| Bugs found | **5**, all **fixed** and retested |
| Console errors | 0 unexpected. All errors seen were intended 400/415 responses |

## Baseline (before testing)
| Check | Result |
|---|---|
| `supabase test db` (pgTAP) | PASS: 133/133 |
| `node src/finance.check.js` | PASS |
| Edge functions (`admin-users`, `kyc-file`) | Serving |

## Bugs (all fixed)

### BUG-1: shared login details point partners and staff at the customer login (Medium)
- **Where:** `src/portal/Partners.jsx` `ShareDetails`.
- **Repro:** Admin → Partner → Add login, or Reset password, or Add staff login. The details show `Login page: …/portal.html`.
- **Actual:** that URL opens the customer (mobile number) login, so the new partner can't sign in with their email.
- **Fix:** `ShareDetails` takes a `login` hash, defaulting to `#/partner`. The customer-login caller (`CustomerAccount.jsx`) passes `#/`.
- **Retest:** the partner reset, staff create and customer create links show `#/partner`, `#/partner` and `#/` respectively. **FIXED**

### BUG-2: dates shown one day early between 00:00 and 05:30 IST (Medium)
- **Where:** 11 call sites did `shortDate(timestamp.slice(0, 10))`. That takes the UTC date, but the DB returns UTC timestamps.
- **Repro:** create a customer at 02:57 IST on 13 Oct. "Customer since" shows **12 Oct 2026**.
- **Also affected:** "Signed by … on", "Paid <date>", "requested on", agreement versions, KYC upload dates, "Closed <date>", and signing-link expiry.
- **Fix:** `fmtDate` in `src/portal/ui.jsx` accepts full timestamps and formats them in local time. The callers no longer slice.
- **Retest:** shows 13 Oct 2026. The customer payouts list reads "Paid 13 Oct 2026". **FIXED**

### BUG-3: two customers can share a mobile number; the second can never get a login (High)
- **Repro:** the partner onboards a customer with mobile `9848010001`, which seeded customer Anil already uses. The customer is saved, signed and approved. Then Create login fails with "Another login already uses this mobile number." The customer is stuck, because customers log in by mobile.
- **Fix:** migration `20261013000021_unique_mobile.sql`, a trigger on `customers` (insert, or update of phone).
  - It refuses a mobile whose last 10 digits match another customer's: "Another customer already uses this mobile number".
  - It covers Add customer and Edit details in one place.
  - It's a trigger rather than a unique index, so existing duplicates in production can't block the deploy.
- **Test:** `supabase/tests/mobile.test.sql` (4 checks).
- **Retest:** the duplicate is refused in the UI with that message. The affected test customer was moved to a new number and its login was created. **FIXED**

### BUG-4: misleading signing step for a rejected application (Low)
- **Where:** `src/portal/Onboarding.jsx` `OnboardingSteps`.
- **Repro:** the admin rejects a signed application.
- **Actual:**
  - Partner and admin see "Signed earlier…, before the application was **reopened**. Create a new link…", but nothing was reopened, and the partner has no button.
  - The admin's "Create signing link" silently skips Reopen.
- **Fix:** a rejected application shows "Exit has to reopen the application before the customer can sign again." The link button is hidden until it's reopened, so Reopen is the only path.
- **Retest:** C4 was rejected → message shown for both partner and admin → Reopen → signed again → approved. **FIXED**

### BUG-5: a withdrawal doesn't reduce a top-up already recorded for a later date (High, money)
- **Where:** `close_month` and `reopen_month`.
- **Cause:** capital rows are running totals. A partial withdrawal only rewrites the row on the 1st of the next month.
- **Repro:**
  1. C1 has ₹1,50,000 and requests a ₹20,000 withdrawal.
  2. Staff record a top-up to ₹2,00,000 from 10 Oct.
  3. The admin closes September.
- **Actual:** the ₹20,000 is paid out (Oct 1 row = ₹1,30,000), but the Oct 10 row stays **₹2,00,000**. From 10 Oct, capital and withdrawable are overstated by ₹20,000.
- **Expected:** ₹1,80,000.
- **Fix:** migration `20261013000022_withdrawal_later_capital.sql`.
  - `close_month` also subtracts the withdrawal from every capital row dated after the 1st.
  - `reopen_month` adds it back to every row dated on or after the 1st.
- **Test:** `supabase/tests/withdrawal.test.sql` (5 checks). Before the fix it failed with `have 150000 / want 130000`.
- **Retest in the app:** corrected the row → reopened September (rows restored to ₹1,50,000 / ₹2,00,000) → re-closed. Now **₹1,30,000 from 1 Oct, ₹1,80,000 from 10 Oct**, and C1's withdrawable is ₹1,29,659.34 (= 1,80,000 − 50,340.66). **FIXED**

## Scenario log

### Public site
| # | Step | Result |
|---|---|---|
| P1 | All nav anchors (`top/services/why/calculator/risk/offices/contact`) exist and navigate | PASS |
| P2 | SIP ₹10,000 × 10y @ 12% shows ₹23.23 L. Independent calc: 23,23,391 | PASS |
| P3 | Lump sum ₹5 L × 10y @ 12% shows ₹15.53 L. Independent calc: 15,52,924 | PASS |
| P4 | Risk quiz: all "C" answers give Aggressive (Equity 80 / Debt 12 / Gold 8). Retake works | PASS |
| P5 | Contact form: empty and bad name/phone/email show inline errors | PASS |
| P6 | Contact submission saved, and visible in portal Requests | PASS |
| P7 | Rate limit: 4th request in 1 hour for the same phone is rejected ("We already have your request…") | PASS |
| P8 | Bot trap (`website` filled) returns 204 and nothing is stored | PASS |
| P9 | 375px mobile: no horizontal scroll, menu opens, anchors work | PASS |
| P10 | tel/mailto/WhatsApp/Maps links well-formed (main number 9999999999) | PASS |

### Admin, partner and onboarding
| # | Step | Result |
|---|---|---|
| L1–L3 | Customer login `#/`, partner login `#/partner`. Wrong password shows an error. Admin login | PASS |
| A1 | Add partner: hidden 120% or share −5% keeps the button disabled | PASS (see O3) |
| A2 | "QA Partner Co" created (20% hidden, 70% share) | PASS |
| A3 | Add login: a 7-character password is blocked. `qa@exit.local` created | PASS |
| A4 | Share-details link | BUG-1 → FIXED |
| A5 | Admin resets the partner password. Audit `PASSWORD` row written | PASS |
| B1 | Partner nav limited to Today/Month/Customers/Requests/Account | PASS |
| B2 | Partner Account hides the hidden charge, shows the 70% share | PASS |
| B3–B4 | Partner changes password. Mismatch blocked. Old password rejected, new one works | PASS |
| C1 | Add customer validation (bad mobile, account mismatch, bad PAN, bad IFSC, duplicate PAN) all blocked | PASS |
| C2 | Partner form has no plan or cap fields. Server forces cap 6% / variable | PASS |
| C3 | Duplicate mobile accepted | BUG-3 → FIXED |
| C4 | "Customer since" date | BUG-2 → FIXED |
| C5 | Signing link. Agreement shows correct name, PAN, partner, ₹1,00,000 and 6% cap | PASS |
| C6 | Signing needs the checkbox, a name and a drawn signature. A link can't be reused. A bogus token is refused | PASS |
| C7 | Signer typed "Someone Else" and it was accepted | Observation O6 |
| C8 | Once signed, the partner can only View (no edits) | PASS |
| D1 | Admin rejects C1 (wrong signer name), then re-link, re-sign, approve | PASS (BUG-4 found here) |
| D2 | Admin sets C3 to the fixed plan, then approves C2 and C3 | PASS |
| D3 | C4 (joined 18 Aug) rejected → reopened → re-signed → approved | PASS, BUG-4 retest |

### Money flow
| # | Step | Result |
|---|---|---|
| E1 | Aug 3–14 (terms 20%/70%): profit, loss, zero day, odd paise, a day that fills every bucket plus overflow | Simulator: 0 mismatches |
| E2 | Mid-month:<br>• terms changed to 25%/60%<br>• C4 joins 18 Aug<br>• C1 funds raised to ₹1,50,000 from 20 Aug<br>• "Split a total" ₹18,000 on 27 Aug | Old entries keep 20/70, new ones use 25/60. Split gave QA 100% (other partners had no August capital) |
| E3 | Aug 17–31 entries | Simulator: **94 rows, 0 mismatches** |
| E4 | September: 22 random days, net loss | Simulator: 0 mismatches |
| E5 | October: 8 random days | Simulator: **128 rows, 0 mismatches** |
| E6 | Concurrency: Chrome holds an unsaved edit while Playwright saves the same day, then Chrome saves | Refused: "Someone else saved QA Partner Co for this day while you were editing…" PASS |
| E7 | Closed month: Daily entry shows "August 2026 is closed", inputs disabled | PASS |

### Payouts and close
| # | Step | Result |
|---|---|---|
| F1 | Closing September before August | "Close earlier months first" PASS |
| F2 | Close August: ₹83,000 to 4 customers. Settlements and CSV match expected | PASS |
| F3 | Reopen August: withdrawal back to open, settlements removed, capital restored. Re-close gives an identical result | PASS (O8) |
| F4 | Mark August paid. Reopening a paid month is refused | PASS |
| F5 | Close September: carried losses, fixed plan pays the cap in a loss month, full exit closes the account, partial withdrawal | PASS (BUG-5 found here) |
| F6 | September CSV: 13 rows, ₹2,99,659.38, bank details decrypted | PASS |
| F7 | A new withdrawal from a customer settled this month blocks reopen: "A customer settled this month has a new withdrawal request. Cancel it first." | PASS |
| F8 | Closing October before it ends | "A month can be closed once it has ended" PASS |

### Customer portal
| # | Step | Result |
|---|---|---|
| G1 | Customer login by mobile. Wrong password shows an error | PASS |
| G2 | MyAccount: latest day, month to date, invested, daily P&L with month picker, payouts, withdraw, masked bank, deposit history, partner phone | PASS |
| G3 | Payouts: Aug ₹6,000 "Paid 13 Oct 2026". Sep ₹20,000 "Processing", including the withdrawal | PASS, matches settlements |
| G4 | Carried-loss alert ("A loss of ₹50,340.66 … is being recovered first") | PASS |
| G5 | Withdrawals: 0 or over the limit blocked. ₹50,000 accepted. A second open request refused by the server. Cancel works. "Withdraw everything" fills the max | PASS (O7) |
| G6 | API probes with a customer token: another customer's withdrawal refused; `customers`, `customer_days`, `franchisee_terms` return `[]`; `my_account` has no cap, bucket or hidden fields | PASS |
| G7 | Customer changes password, logs out, logs in with the new password | PASS |

### Remaining pages and permissions
| # | Step | Result |
|---|---|---|
| H1 | Partner API probes:<br>• `close_month` → "Only an admin…"<br>• insert `daily_entries` → RLS refused<br>• `franchisee_terms` and `audit_log` → `[]`<br>• only own customers and settlements visible<br>• `admin-users` → "Only an admin can manage logins." | PASS |
| H2 | Requests:<br>• admin allocates to QA Partner, adds a note, marks contacted<br>• partner sees it under Contacted, closes it, can't reallocate<br>• filters by status and office | PASS |
| H3 | Agreement: v2 published. "Earlier versions: v1 (13 Oct 2026)" | PASS |
| H4 | Month view, admin: invested ₹33,30,000, per-partner Entered, heatmap. Partner view: net only. QA figures reconciled by hand | PASS |
| H5 | Dashboard (Oct 12): QA partner earned ₹9,990.26 = 60% × (22,200.59 × 75%), all buckets full | PASS |
| H6 | KYC upload (PNG) shows "Replace". `.exe` rejected: "Upload a photo (JPEG, PNG, WebP) or a PDF." (415) | PASS |
| H7 | Staff login: add (link `#/partner`), change office to Hyderabad, remove. Own admin login has no Remove | PASS |
| H8 | Inactive partner sees 0 customers. Their customers can still see their own accounts. Reactivating restores access | PASS (O9) |
| H9 | Delete partner works for a mistaken partner. No Delete button for a partner with customers | PASS |
| H10 | Help drawer: role-specific content for admin, partner and customer | PASS |
| H11 | Login with no profile shows "This login isn't linked to a partner account" on every route | PASS |
| H12 | Activity log: field diffs, "Show older" (50 → 100), filter by type, correct actors, "System or customer" for anonymous actions | PASS |

## Roles × routes (all 16 routes opened as each role)
| Route | Admin | Staff | Partner | Customer |
|---|---|---|---|---|
| `#/today`, `#/today/<date>`, `#/month` | ✓ | ✓ | ✓ (net figures) | → MyAccount |
| `#/entry` | ✓ | ✓ | → Today | → MyAccount |
| `#/customers`, `/new`, own customer | ✓ | ✓ | ✓ | → MyAccount |
| another partner's customer | ✓ | ✓ | "does not exist or is not yours" | → MyAccount |
| `#/requests` | ✓ | ✓ | ✓ (allocated only) | → MyAccount |
| `#/partners`, `/<id>`, `#/months`, `#/agreement`, `#/activity` | ✓ | → Today | → Today | → MyAccount |
| `#/account` | ✓ | ✓ | ✓ | → MyAccount |
| unknown route | → Today | → Today | → Today | → MyAccount |

There were 0 console errors across all 64 page loads.

## Money reconciliation (expected = independent calc, app = settlements, CSV = payout file)
| Month | Customer | Plan | Result | Carried in → out | Withdrawal | Expected payout | App | CSV |
|---|---|---|---|---|---|---|---|---|
| Aug | C1 Kiran | variable | +6,000.00 (cap of ₹1L on 1 Aug) | 0 → 0 | – | 6,000.00 | 6,000.00 | 6,000.00 |
| Aug | C2 Lalitha | variable | +15,000.00 | 0 → 0 | 50,000 (capital 2.5L → 2L from 1 Sep) | 65,000.00 | 65,000.00 | 65,000.00 |
| Aug | C3 Mohan | **fixed** | +3,000.00 | – | – | 3,000.00 | 3,000.00 | 3,000.00 |
| Aug | C4 Neha (joined 18 Aug) | variable | +9,000.00 | 0 → 0 | – | 9,000.00 | 9,000.00 | 9,000.00 |
| Sep | C1 Kiran | variable | −50,340.66 | 0 → −50,340.66 | 20,000 (partial) | 20,000.00 | 20,000.00 | 20,000.00 |
| Sep | C2 Lalitha | variable | −67,120.86 | 0 → −67,120.86 | – | 0.00 | 0.00 | (not listed) |
| Sep | C3 Mohan | **fixed** | −16,780.20 | – | – | 3,000.00 (cap even in a loss) | 3,000.00 | 3,000.00 |
| Sep | C4 Neha | variable | −50,340.62 | 0 → 0 (cleared) | full exit: 1,50,000 − 50,340.62 | 99,659.38 | 99,659.38 | 99,659.38 |
| Oct (open) | C1 / C2 / C3 | | credited 7,800 / 12,000 / 3,000. Bucket on capital in force 1 Oct (1.3L, 2L, 50k) | | | at close: 0 (carry −42,540.66) / 0 (carry −55,120.86) / 3,000 | accruals match | – |

**Totals:** August ₹83,000.00 to 4 customers. September ₹2,99,659.38 to 13 customers (seeded ₹1,77,000 + QA ₹1,22,659.38).

**Overflow check (6 Aug):** net ₹4,000 → ₹2,000 fills the buckets, ₹2,000 overflow → partner ₹1,400 (70%), Exit ₹600.

## Audit-log coverage
| Event | Logged | Actor |
|---|---|---|
| Partner, terms, terms edit, active toggle | ✓ | Admin |
| Logins created (partner, staff, customer), admin password reset (`PASSWORD`) | ✓ | Admin or partner |
| Customer create, edit, status changes (draft → … → active, rejected, closed) | ✓ | Partner or admin. Signing shows "System or customer" |
| Capital changes, including close and reopen adjustments | ✓ | Admin |
| Daily entries (insert and update with diff) | ✓ | Admin |
| Closed months, settlements, mark paid | ✓ | Admin |
| Withdrawal requests (request, cancel, settle) | ✓ | Customer or admin |
| Call-back requests (public insert, allocation, notes, status) | ✓ | Anonymous, then admin or partner |
| Self-service password change (partner or customer) | **✗ not logged** | – (O10) |

## Observations and decisions (2026-10-13)
Decided with the product owner after the first pass, then built and verified in the browser:

| # | Observation | Decision | Status |
|---|---|---|---|
| O1 | No forced password change on first login | Force it | **Done:** every password Exit hands out is temporary, and the portal shows only "Choose your own password" until it's changed |
| O2 | Password change doesn't ask for the current one | Ask for it | **Done:** "Your current password is wrong." (not asked on the forced first change) |
| O3 | Out-of-range % gives no message | Explain | **Done:** "Enter a number from 0 to 100." |
| O4 | Phones shown as typed | One format | **Done:** `+91 98765 43210` everywhere |
| O5 | DB clock UTC: a month can't close until 05:30 IST on the 1st | – | Open (low impact) |
| O6 | Signer name not checked | Block a mismatch | **Done:** Sign stays disabled, and the server refuses (case, spacing and punctuation ignored) |
| O7 | Withdrawable ignores this month's loss | Add a note | **Done:** "Your September 2026 result so far is -₹4,321.50. It is taken off what you can withdraw when September 2026 closes." |
| O8 | Reopen leaves a phantom deposit row | Clean up | **Done:** reopen drops the row its close added |
| O9 | Inactive partner sees an empty portal | Message | **Done:** "Your partner account is paused. Call the Exit office…" |
| O10 | Own password changes not logged | Log them | **Done:** Activity shows "Login password changed" (vs "password reset" by Exit) |
| O11 | Reject: no confirmation or reason | Reason + confirm | **Done:** dialog needs a reason, and the partner sees "Exit rejected this application: <reason>" |
| O12 | Plan or capital change after signing not in the signed agreement | Re-sign | **Done:** after signing, changing name, PAN, partner, cap %, plan or capital sends the application back to draft for a new signature. Active customers unaffected |
| O13 | MUI aria-hidden warning when Help opens | Fix | **Done:** no warning |
| O14 | Office phone numbers are placeholders | Leave for now | Open: real numbers to come |

**Environment note:** this machine's LAN IP changed (192.168.88.7 → 192.168.88.19), so `.env.local`'s `VITE_SUPABASE_URL` no longer reaches the local API. For this run the dev server was started with `VITE_SUPABASE_URL=http://127.0.0.1:54321`. `.env.local` was not edited.

## Files changed
| File | Change |
|---|---|
| `src/portal/Partners.jsx`, `src/portal/CustomerAccount.jsx` | BUG-1 |
| `src/portal/ui.jsx` (+ removed `.slice(0, 10)` in `Admin.jsx`, `Customer.jsx`, `CustomerAccount.jsx`, `MyAccount.jsx`, `Onboarding.jsx`) | BUG-2 |
| `supabase/migrations/20261013000021_unique_mobile.sql`, `supabase/tests/mobile.test.sql` | BUG-3 |
| `src/portal/Onboarding.jsx` | BUG-4 |
| `supabase/migrations/20261013000022_withdrawal_later_capital.sql`, `supabase/tests/withdrawal.test.sql` | BUG-5, O8 |
| `supabase/migrations/20261013000023_password_change.sql`, `supabase/functions/admin-users/index.ts`, `src/portal/Account.jsx`, `src/portal/PortalApp.jsx`, `src/portal/Admin.jsx`, `supabase/tests/password.test.sql` | O1, O2, O10 |
| `supabase/migrations/20261013000024_signer_name.sql`, `src/portal/Sign.jsx`, `supabase/tests/signing.test.sql` | O6 |
| `supabase/migrations/20261013000025_withdraw_note.sql`, `src/portal/MyAccount.jsx`, `supabase/tests/account.test.sql` | O7 |
| `supabase/migrations/20261013000026_admin_review.sql`, `src/portal/Onboarding.jsx`, `src/portal/Customer.jsx`, `supabase/tests/review.test.sql` | O11, O12 |
| `src/portal/Partners.jsx`, `ui.jsx`, `Customers.jsx`, `Requests.jsx`, `Layout.jsx`, `PortalApp.jsx` | O3, O4, O9, O13 |

## Final verification
Run on a freshly reset DB, with all 22 migrations and the seed applied cleanly:
| Check | Result |
|---|---|
| `supabase test db` | **PASS: 161/161, 14 files** (133 original + 4 mobile + 5 withdrawal + 4 password + 3 signing + 2 account + 10 review) |
| `node src/finance.check.js` | PASS |
| `vite build` | PASS |

Notes:
- `customers.test.sql` fails while QA data with closed 2026 months is in the DB ("Reopen later months first"). The tests assume no later closed months, so run them on a reset DB.
- The final reset wiped the QA scenario data. Replaying sections A–G above recreates it.
