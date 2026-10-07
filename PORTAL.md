# Exit Partner Portal

The landing page (`index.html`) is unchanged. The portal is a second page, `portal.html`, backed by
[Supabase](https://supabase.com): Postgres, logins, private file storage and one server function.

- **Partners** see each day's results for their customers, onboard new customers, and send signing links.
- **Exit staff** enter daily results (by hand or CSV), and see every partner and customer.
- **Exit admins** also approve customers, manage partners and logins, close months, edit the agreement, and see the activity log.
- **Customers** never log in. They open a signing link, read the agreement and sign on their phone.

All money maths runs inside the database (`supabase/migrations/*_calc.sql`). The browser only displays results.

## Payout rules

Each day Exit enters **one profit/loss figure per partner**, after broker charges. Then, for that partner:

1. **Hidden charge.** On a profitable day Exit takes the partner's hidden charge, for example 20%. The partner sees only what's left: ₹1,00,000 shows as ₹80,000. Losses carry no charge. Partners can never read the entered figure or the charge %.
2. **Customer buckets.** Each customer has a monthly bucket of cap % × capital (default 6%). The partner's amount is shared among the customers in proportion to their capital until the buckets are full. If one bucket fills early, its extra goes to the customers who still have room.
3. **Profit share.** Once every bucket is full, the rest is split by the partner's profit share, for example 70% to the partner and 30% to Exit. Partners see both figures.
4. **Losses.** A loss comes out of the customers' buckets in proportion to their capital. Partner income already earned is kept. Later profit refills the buckets before the partner earns again.

Buckets reset on the 1st of each month. Amounts are rounded to whole paise so every split adds up exactly. The hidden charge and profit share are copied onto each day when it's first entered, so changing them later only affects new days.

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

Other local addresses:

- Database admin (Studio): http://127.0.0.1:54323
- Emails that would have been sent, such as password resets: http://127.0.0.1:54324

Other commands:

```bash
npm run db:test         # 65 database tests: payouts, security, onboarding, record keeping, encryption
npm run db:reset        # wipe and reload test data
node src/finance.check.js
```

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
   - Set **Site URL** to the live portal, e.g. `https://<user>.github.io/exit/portal.html`, and add it to **Redirect URLs**. This is needed for password-reset emails.
   - Set up custom SMTP so reset emails come from your domain. The built-in sender is heavily rate-limited.
4. **Password-reset email.** In Dashboard → Authentication → Email Templates → Reset Password, paste the contents of `supabase/templates/recovery.html`. This makes reset links work on any device.
5. **Create the first admin.** Go to Dashboard → Authentication → Add user, enter your email and a password, and tick auto-confirm. Then in the SQL editor:
   ```sql
   insert into profiles (id, full_name, email, role)
   select id, 'Your Name', email, 'admin' from auth.users where email = 'you@example.com';
   ```
   After that, create every other login from the portal's Partners page.
6. **Write the agreement.** As admin, open More → Agreement and publish version 1. Have a lawyer review the text first.
7. **Connect the website** (GitHub → Settings → Secrets and variables → Actions → Variables). Add these two values from Dashboard → Project Settings → API:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the publishable or anon key, never the service key)

   The next push to `main` deploys the portal. Without these variables the portal page says it isn't set up yet, and the landing page still works.

**Staging:** create a second Supabase project and repeat steps 1–6 against it. Use `npx supabase link` to switch between the two.

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
