# Exit Partner Portal

The landing page (`index.html`) is unchanged. The portal is a second page, `portal.html`, backed by
[Supabase](https://supabase.com): Postgres, logins, private file storage and one server function.

- **Partners** see each day's results for their customers, onboard new customers, and send signing links.
- **Exit staff** enter daily results, and see every partner and customer.
- **Exit admins** also approve customers, manage partners and logins, close months, edit the agreement, and see the activity log.
- **Customers** sign the agreement from a link on their phone. Once approved, their partner can give them a login (mobile number + password) to a one-page view of their daily profit/loss, payouts, account details and withdrawal requests. They never see their cap %, bucket or whether the cap is reached.

All money maths runs inside the database (`supabase/migrations/*_calc.sql`). The browser only displays results.

## Payout rules

Each day Exit enters **one profit/loss figure per partner**, after broker charges. Or use **Split a total** on Daily entry: type the day's total once and each partner's figure is filled in, in proportion to their customers' capital on that day. Check the figures, then save. Then, for each partner:

1. **Trade charges.** On a profitable day Exit takes the partner's trade-charge % (brokerage, taxes and regulatory charges, for example 20%) before sharing. The partner sees only what's left: ₹1,00,000 shows as ₹80,000. Losses carry no charge. Partners and customers never see the entered figure or the %.
2. **Customer buckets.** Each customer has a monthly bucket of cap % × capital on the 1st (default 6%), plus a pro-rated share for money added during the month: cap % × amount × (days left from the day it starts counting) ÷ (days in the month). Example: ₹1,00,000 on the 1st gives ₹6,000; ₹50,000 counting from the 16th of a 30-day month adds ₹1,500, so ₹7,500. Each day's amount is shared among customers in proportion to **their capital that day** until buckets are full. If one bucket fills early, its extra goes to the customers who still have room.
3. **Profit share.** Once every bucket is full, the rest is split by the partner's profit share, for example 70% to the partner and 30% to Exit. Partners see both figures.
4. **Losses.** A loss comes out of the customers' buckets in proportion to their capital that day. Partner income already earned is kept. Later profit refills the buckets before the partner earns again.

### Deposits

Staff record **Add money** with the amount added and when it reached Exit's bank account. Money received **before 12:00 noon IST counts from the next day; from 12:00 noon, from the day after**. The server works out the date; the dialog previews it with the bucket increase. Capital is a ledger of movements (deposits, withdrawals, exits, corrections), never edited, only undone (open months only).

### Month close and payouts

Each month **closes automatically at 11:30 PM IST on its last day** (a pg_cron job), unless an admin already closed it that day from the Months page. Closing works out each customer's payout:

- **Variable plan** (default): the month's result, after recovering any loss carried from earlier months. A negative balance is carried forward; nothing is paid.
- **Fixed plan**: the month's (pro-rated) bucket every month, whatever the result. Exit absorbs any shortfall.
- **Withdrawals**: an open request is paid too, capped at capital on the 1st of next month less any carried loss. Capital drops by that amount from the 1st; withdrawing everything pays back all capital (including money not yet counting) and closes the account.

Then **Download payout file** (CSV for the bank's bulk payment: beneficiary, account, IFSC, amount), and **Mark paid** once the bank confirms. A month can be reopened only until it's marked paid. Money comes in from, and goes back to, the customer's registered bank account only.

### Emergency exit

A customer (in their app) or their partner can ask; an admin sees the figures on the customer's page and pays out at once:

- **Variable plan**: capital + this month's result so far (up to the last entered day) + any carried loss, never below ₹0.
- **Fixed plan**: capital in full; no payout for the part-month.

The account closes, and that partner's days up to the last result included become **final**: they can't be edited, and later changes (another customer's cap %, a backdated deposit) don't alter them. Earlier months must be closed first. The payout has its own bank file and Mark paid, and never appears in a month's payout file.

Buckets start fresh on the 1st of each month. Paise are split with exact integer arithmetic so every split adds up exactly. Trade charges and profit share are copied onto each day when it's first entered, so changing them later only affects new days.

### Checking the books

`select * from check_books();` lists any broken money rule (no rows = the books balance); it's read-only and safe on live data. `node scripts/fuzz-payouts.mjs 200` runs random scenarios through the real functions against an independent simulator (local stack only).

## Run it locally

You need Docker running.

```bash
npm install
npm run db:start        # local Supabase in Docker; applies migrations and test data
npm run db:functions    # in a second terminal: serves the login-creation function
npm run dev             # http://localhost:5173/portal.html
```

Create `.env.local` (it's gitignored) with the values `db:start` prints:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<publishable key>
```

Test logins all use the password `password123`:

| Email | Role |
|---|---|
| admin@exit.local | Exit admin |
| staff@exit.local | Exit staff |
| ravi@exit.local, priya@exit.local | Partners |
| mobile `9848010001` | Customer (Anil Varma) |

Other local addresses:

- Database admin (Studio): http://127.0.0.1:54323

Other commands:

```bash
npm run db:test         # 134 database tests: payouts, settlements, security, onboarding, record keeping, encryption
npm run db:reset        # wipe and reload test data
node src/finance.check.js
```

## Production

| | |
|---|---|
| Supabase organization | Exit Stock Broker (Free plan) |
| Project | `exit-portal` (`sxtndyhjvrthsvvhzdvi`), Mumbai |
| Portal | https://exitstocks.com/portal.html |
| Login settings | Public sign-up off; reset links go to exitstocks.com (`[remotes.production]` in `supabase/config.toml`, applied with `npx supabase config push`) |

**Free plan limits to know:**
- **No daily database backups** on Free. Set up the nightly backup below, or upgrade to Pro.
- **The project pauses** after a week without use.

## Go live

1. **Create a Supabase project** at supabase.com. Choose the Mumbai region, which is closest to your users.
2. **Apply the database and the function** from this repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push                                # migrations only; test data is never pushed
   npx supabase functions deploy admin-create-user
   npx supabase functions deploy kyc-file
   ```
   **Then save the encryption key** (see "Encryption" below) before anyone enters a real customer.
3. **Auth settings** (Dashboard → Authentication):
   - Turn **off** "Allow new users to sign up". Only admins create logins.
   - Set **Site URL** to the live portal, e.g. `https://exitstocks.com/portal.html`.
4. **Create the first admin.** Go to Dashboard → Authentication → Add user, enter your email and a password, and tick auto-confirm. Then in the SQL editor:
   ```sql
   insert into profiles (id, full_name, email, role)
   select id, 'Your Name', email, 'admin' from auth.users where email = 'you@example.com';
   ```
   After that, create every other login from the portal's Partners page.
5. **Write the agreement.** As admin, open More → Agreement and publish version 1. Have a lawyer review the text first.
6. **Connect the website** (GitHub → Settings → Secrets and variables → Actions → Variables). Add these two values from Dashboard → Project Settings → API:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the publishable or anon key, never the service key)
   - `VITE_SEBI_REGISTERED`: leave unset until SEBI registration is granted. Set it to `true` (and fill in the numbers in `src/config.js`) to show the registration chip, the "Regulated" pillar, the footer numbers and the SEBI disclaimer.

   The next push to `main` deploys the portal. Without these variables the portal page says it isn't set up yet, and the landing page still works.

**Staging:** create a second Supabase project and repeat steps 1–5 against it. Use `npx supabase link` to switch between the two.

## Logins and passwords

There's no "forgot password" email. Exit admins manage every login on the **Partners** page:

- **Add login:** creates a partner or staff login with a temporary password to share privately.
- **Reset password:** sets a new temporary password; the old one stops working straight away.
- **Remove login:** deletes a login, for example one created with a typo. A partner's logins are listed under that partner; staff logins are at the bottom. Customers, results and activity they created stay.
- **Delete partner:** only for a partner added by mistake, with no customers or results yet. Its logins go too. Otherwise mark the partner inactive.

Anyone can change their own password from their Account page. An admin can't remove their own login, or the last admin.

## Call-back requests

The website's contact form saves each request to the portal's **Requests** page for the office the visitor chose. Admins see every office. Staff see the office set on their login (Partners page → logins → Office); staff with "All offices" see everything. Partners see only the requests allocated to them.

Staff can call or WhatsApp from the request, add a note, and mark it contacted, closed or reopened. **Add request** logs one that came in by phone or at the office. **Allocated to** passes a request to a partner: that partner then sees it on their own Requests page and can add notes and change its status, but can't pass it on. Exit still sees it. Requests are never deleted. The form has a hidden bot trap and limits repeats: 3 an hour from one phone number, and 5 every 10 minutes from one network. The office list is `offices` in `src/config.js` plus `office_names()` in the database; change both together.

## Encryption

PAN numbers, Aadhaar digits, signed agreement text and KYC photos are encrypted with AES-256.

- **The key** is created inside the database when it's first set up and kept in Supabase Vault. It's not in this code, in Git, or in backups.
- **PAN and Aadhaar numbers** are only decrypted by database functions that first check the viewer is Exit staff or the customer's own partner. The encrypted columns can't be read or written from the website at all, not even by an admin.
- **Duplicate PANs** are caught by comparing keyed fingerprints, never the PAN itself.
- **KYC photos** pass through the `kyc-file` server function. It encrypts each photo before storing it and decrypts it only for permitted viewers. Storage and its backups only ever hold scrambled bytes.
- **The activity log** records that a PAN or Aadhaar changed, never the value.

**Save the key once, right after going live**, and keep it safe. Without it, a backup can't be read after restoring to a new project. In the Supabase SQL editor:

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'pii_key';
```

Store the result in a password manager that two trusted people can access. Never put it in email, chat or Git, and never next to the backups.

## Records are never deleted

The database itself enforces these rules, for every login including the Supabase dashboard:

- **Customers** can't be deleted. Reject or deactivate them instead.
- **KYC documents** keep every version. Uploading a new PAN photo adds a version and the old one stays viewable as "Earlier".
- **KYC files** in storage can't be deleted or overwritten, even with the service key or "Empty bucket".
- **Signed agreements** can't be changed or deleted. Unsigned links can still be replaced.

## Backups

Two layers. Use both.

**1. Supabase backups (database only).** On the Pro plan, Supabase keeps daily database backups for 7 days. Add Point-in-Time Recovery if you want to restore to any minute. **These don't include the KYC files.**

**2. Nightly copy to separate storage (database and KYC files).** `.github/workflows/backup.yml` runs `scripts/backup.sh` every night at 02:00 IST:
- a full database dump goes to `db/<date-time>/` (structure, data, logins and the file list);
- every KYC file is copied to `kyc/`;
- nothing at the destination is ever deleted or replaced.

Set it up once:
1. Create a private bucket on an S3-compatible service in a different account from Supabase: Cloudflare R2, AWS S3 (Mumbai) or Backblaze B2. Turn on object lock or versioning if offered. Create an access key that can only write to that bucket.
2. In Supabase: Project Settings → Storage → S3 Connection. Note the endpoint and region, and create an access key.
3. In GitHub: Settings → Secrets and variables → Actions:
   - **Secrets:**
     - `SUPABASE_DB_URL`: Database → Connection string (session pooler, with password)
     - `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`
     - `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
   - **Variables:**
     - `BACKUP_PATH`: bucket and folder, e.g. `exit-backups/portal`
     - `BACKUP_S3_PROVIDER`: `Cloudflare`, `AWS` or `Other`
     - `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`
4. Actions → Nightly backup → Run workflow, and check the files appear. Until `BACKUP_PATH` is set, the job is skipped.

**Restore** (tested locally with encryption on: a wiped database came back identical, every record, login, decrypted PAN and KYC file):
1. Create a fresh Supabase project, run `npx supabase db push`, and deploy both functions. This creates the tables and the `kyc` bucket.
2. Put the saved encryption key back, replacing the one the new project generated (SQL editor):
   `select vault.update_secret(id, '<saved key>') from vault.secrets where name = 'pii_key';`
3. Restore the data: `psql "<new SUPABASE_DB_URL>" -v ON_ERROR_STOP=1 -f db/<date-time>/data.sql`
4. Copy the files back: `rclone copy dst:<BACKUP_PATH>/kyc src:kyc`, with `src` pointing at the new project.

Restore into a new project rather than over a damaged one, check it, then switch the website's `VITE_SUPABASE_*` variables to it.

## Compliance notes

- **Aadhaar:** only the last 4 digits are stored. Ask customers to upload *masked* Aadhaar copies (UIDAI rules).
- **KYC files and PAN:** encrypted at rest (see "Encryption"). They are decrypted only for Exit staff and the customer's own partner.
- **Signing record:** each signature stores the exact agreement text the customer saw, a SHA-256 fingerprint of it, the drawn signature, the typed name, the time, the IP address and the device. For stronger legal standing, an Aadhaar eSign provider (Digio, Leegality) can be added later.
- **Audit trail:** every change to customers, KYC, capital, entries, partners, logins and months is recorded in the activity log, with who made it.
