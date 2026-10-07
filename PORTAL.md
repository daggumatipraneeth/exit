# Exit Partner Portal

The landing page (`index.html`) is unchanged. The portal is a second page, `portal.html`, backed by
[Supabase](https://supabase.com): Postgres, logins, private file storage and one server function.

- **Partners** see each day's results for their customers, onboard new customers, and send signing links.
- **Exit staff** enter daily results (by hand or CSV), and see every partner and customer.
- **Exit admins** also approve customers, manage partners and logins, close months, edit the agreement, and see the activity log.
- **Customers** never log in. They open a signing link, read the agreement and sign on their phone.

All money maths runs inside the database (`supabase/migrations/*_calc.sql`). The browser only displays results.

## Payout rules

For each customer, each trading day:

```
pnl      = gross profit/loss − broker charges − other charges
exit cut = partner's Exit commission % × pnl     (only when pnl > 0)
net      = pnl − exit cut
cap      = customer's capital on the 1st of the month × cap % (default 6%)
```

Within each calendar month the customer's share builds up day by day. Whatever goes above the cap goes to the partner.
A loss reduces the customer's share. Partner income already earned is not taken back. Everything resets on the 1st.

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
npm run db:test         # 32 database tests: payouts, security, onboarding
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
   ```
3. **Auth settings** (Dashboard → Authentication):
   - Turn **off** "Allow new users to sign up". Only admins create logins.
   - Set **Site URL** to the live portal, e.g. `https://<user>.github.io/exit/portal.html`, and add it to **Redirect URLs**. This is needed for password-reset emails.
   - Set up custom SMTP so reset emails come from your domain. The built-in sender is heavily rate-limited.
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

   The next push to `main` deploys the portal. Without these variables the portal page says it isn't set up yet, and the landing page still works.

**Staging:** create a second Supabase project and repeat steps 1–5 against it. Use `npx supabase link` to switch between the two.

## Compliance notes

- **Aadhaar:** only the last 4 digits are stored. Ask customers to upload *masked* Aadhaar copies (UIDAI rules).
- **KYC files:** these sit in a private storage bucket. They are shown only through links that expire after 10 minutes, and only to Exit staff and the customer's own partner.
- **Signing record:** each signature stores the exact agreement text the customer saw, a SHA-256 fingerprint of it, the drawn signature, the typed name, the time, the IP address and the device. For stronger legal standing, an Aadhaar eSign provider (Digio, Leegality) can be added later.
- **Audit trail:** every change to customers, KYC, capital, entries, partners, logins and months is recorded in the activity log, with who made it.
