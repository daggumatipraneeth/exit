# Legal review notes (for Exit's lawyer)

**Prepared:** 13 October 2026, alongside the new client agreement (v2) and website legal pages.

Everything below is a *draft written by the development team, not legal advice*. The documents implement the business rules the portal enforces. The points marked **HIGH** should be settled before any client money is accepted under these terms.

**Where the drafts are:**

| Draft | Location |
|---|---|
| Client agreement v2 | `supabase/migrations/20261013000030_agreement_v2.sql`. Admin → Agreement shows it with sample fill-ins. |
| Terms of use, Privacy policy, Risk disclosure | `src/sections/Legal.jsx`. Live at `/#/terms`, `/#/privacy` and `/#/risk`. |

## What the agreement commits Exit to (as the system calculates it)
- **Deposits** are by bank transfer from the registered account only; no cash, and partners never handle money. Money received **before 12:00 noon IST counts from the next day; from 12:00 noon, from the day after**.
- **Monthly cap:** cap % × capital on the 1st, plus each later deposit pro rata, as cap % × amount × (days left in the month from its start) ÷ (days in the month).
- **Sharing:** each day's result, after all trade charges, is shared by each client's capital that day. Profit is credited only up to the client's cap; profit above every cap goes to Exit and the partner.
- **Profit Share plan:** a loss carries forward and is recovered first. The client never owes more than their capital.
- **Fixed Monthly Payout plan:** Exit pays the monthly cap every month whatever the result, and returns the principal in full on an emergency exit.
- **Month close:** months close on their last day (automatically at 11:30 PM IST). Payouts go to the registered account within 7 working days. *This 7-day timeline is a business commitment; please confirm.*
- **Withdrawals** are paid with the month's payout. Withdrawing everything closes the account.
- **Emergency exit** settles immediately on the results entered so far:
  - Profit Share: capital + month result + carried loss, floored at 0.
  - Fixed: capital only.
- **Disputes:** sole arbitrator under the Arbitration and Conciliation Act, 1996, seated in Guntur, with the courts at Guntur.

## Points to decide

| # | Priority | Point | Why it matters |
|---|---|---|---|
| 1 | **HIGH** | Is the arrangement a regulated activity? Exit pools clients' money, trades it, and shares profit above a cap. | This may be portfolio management (SEBI (Portfolio Managers) Regulations, 2020: registration, a ₹50 lakh minimum, no pooling), an AIF, or a collective investment scheme (SEBI Act s.11AA). A stock broker dealing in client funds outside the Stock Brokers Regulations is restricted. |
| 2 | **HIGH** | The **Fixed Monthly Payout** plan: a fixed monthly return whatever the result, plus principal returned in full. | It risks being treated as a **deposit** under the Banning of Unregulated Deposit Schemes Act, 2019 (criminal liability) or the Companies (Acceptance of Deposits) Rules, 2014. Assured returns also conflict with SEBI's rules for intermediaries. The draft says "no return is guaranteed *except* as stated for the Fixed plan"; that exception is the risk. |
| 3 | **HIGH** | **Partners** introduce and service clients. | They may need registration as Authorised Persons with the exchanges. The draft forbids partners from taking money or making promises. |
| 4 | Medium | **Trade charges** are deducted from each profitable day before sharing. They're applied as a flat percentage and reconciled a day later. | The agreement says results are "after all trade charges" without giving the %. Consider whether the method of estimating them should be disclosed, and how any difference between the estimate and the actual charges is handled. |
| 5 | Medium | **Stamp duty** on the agreement (Andhra Pradesh Stamp Act, also the Telangana Stamp Act for Hyderabad clients). | |
| 6 | Medium | **TDS** on profit payouts (e.g. s.194A or another section) and the client's tax treatment. | |
| 7 | Medium | **Electronic signature:** the portal records a drawn signature with time, IP and device, and stores the exact signed text with a SHA-256 hash. | Consider Aadhaar eSign (IT Act 2000, Second Schedule) for stronger evidence. |
| 8 | Medium | **Changing terms:** clause 21 allows changes on 30 days' notice. | The portal already shows "Agreement out of date" and lets staff send the new version to sign. Decide whether unsigned clients should be blocked from new deposits. |
| 9 | Low | **Grievance timelines:** 2 working days to acknowledge, 15 days to resolve. Also a named grievance officer. | Name to be added once appointed. |
| 10 | Low | **Data retention:** 5 years after closure, per PMLA record-keeping. | Confirm the period and that the contact-form retention of 2 years is acceptable. |
| 11 | Low | **Nomination and death:** the draft closes the account at month end and pays nominees or heirs. | Consider adding a nomination form to onboarding. |

## Placeholders still to fill
- Office phone numbers in `src/config.js` (`+91 90000 00001/2`) and the Hyderabad address.
- SEBI, AMFI and CIN numbers (`config.js`). They are hidden until `VITE_SEBI_REGISTERED=true`.
- The grievance officer's name and email.
