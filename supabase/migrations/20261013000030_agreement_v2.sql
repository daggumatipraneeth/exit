-- Agreement version 2: a full draft for legal review, matching the money rules the portal enforces
-- (counts from the next day, pro-rated buckets, carry-forward, fixed plan, month-end close, emergency exit).
-- New fill-ins: {{plan}}, {{plan_terms}}, {{mobile}}, {{bank}} (masked) and {{partner_phone}}.

create or replace function render_agreement(p_agreement uuid) returns text
language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(t.body,
    '{{plan_terms}}', case when c.plan = 'fixed'
      then 'The Client has chosen the <strong>Fixed Monthly Payout</strong> plan. For every calendar month in which the Client''s Capital is with Exit, Exit shall pay the Client an amount equal to the Monthly Cap (clause 5) for that month, whatever the trading result of that month. Trading results of the month, profit or loss, belong to Exit. No loss is carried forward against the Client.'
      else 'The Client has chosen the <strong>Profit Share</strong> plan. For each calendar month the Client receives the Client''s share of the trading result, up to the Monthly Cap (clause 5). A loss is carried forward and recovered from later profits before any further payout (clause 6).' end),
    '{{plan}}', case when c.plan = 'fixed' then 'Fixed Monthly Payout' else 'Profit Share' end),
    '{{mobile}}', html_escape(c.phone)),
    '{{bank}}', html_escape(coalesce(c.bank_holder, '') || ' · account ending ' || coalesce(c.bank_last4, '') || ' · IFSC ' || coalesce(c.bank_ifsc, ''))),
    '{{partner_phone}}', html_escape(coalesce(f.phone, ''))),
    '{{full_name}}', html_escape(c.full_name)),
    '{{pan}}', html_escape(pii_decrypt(c.pan_enc))),
    '{{franchisee}}', html_escape(f.name)),
    '{{cap_pct}}', rtrim(to_char(c.cap_pct, 'FM990.##'), '.')),
    '{{capital}}', '₹' || to_char(total_capital(c.id), 'FM99,99,99,99,999')),
    '{{date}}', to_char(now() at time zone 'Asia/Kolkata', 'FMDD FMMonth YYYY'))
  from agreements a
  join agreement_templates t on t.version = a.template_version
  join customers c on c.id = a.customer_id
  join franchisees f on f.id = c.franchisee_id
  where a.id = p_agreement
$$;

insert into agreement_templates (title, body)
values ('Client Trading Agreement v2', $html$
<h1>Client Trading Agreement</h1>
<p><em>DRAFT for legal review. Not to be used until approved by Exit's legal counsel.</em></p>
<p>This agreement is made on <strong>{{date}}</strong> between:</p>
<ol type="a">
  <li><strong>Exit Stock Broker Private Limited</strong> ("Exit"), and</li>
  <li><strong>{{full_name}}</strong>, PAN {{pan}}, mobile {{mobile}} (the "Client"),</li>
</ol>
<p>introduced by Exit's partner <strong>{{franchisee}}</strong> (the "Partner", phone {{partner_phone}}).</p>

<h2>1. Definitions</h2>
<ol>
  <li><strong>Capital</strong>: money the Client has placed with Exit under this agreement, less withdrawals. It is {{capital}} on the date above.</li>
  <li><strong>Registered Bank Account</strong>: {{bank}}. All money comes from and goes back to this account only.</li>
  <li><strong>Trade Charges</strong>: brokerage, exchange and clearing charges, Securities Transaction Tax, GST, stamp duty, SEBI turnover fees and every other statutory or regulatory charge on trading.</li>
  <li><strong>Trading Day Result</strong>: Exit's trading profit or loss for a day on the pool that includes the Client's Capital, after all Trade Charges.</li>
  <li><strong>Plan</strong>: {{plan}} (clause 4).</li>
  <li>Times are Indian Standard Time; a "month" is a calendar month.</li>
</ol>

<h2>2. Nature of this agreement</h2>
<ol>
  <li>The Client places Capital with Exit for trading in securities and derivatives on recognised stock exchanges, on the terms below.</li>
  <li>Capital is exposed to market risk at all times. This agreement is not a deposit, loan, chit or collective investment scheme. <strong>No return is guaranteed</strong> except as expressly stated for the Fixed Monthly Payout plan.</li>
  <li>Past results, projections and illustrations (including any calculator on Exit's website) are not a promise of future results.</li>
</ol>

<h2>3. Capital and deposits</h2>
<ol>
  <li>Money is accepted only by bank transfer from the Registered Bank Account to Exit's bank account. Exit never accepts cash. The Partner is not authorised to receive money for Exit.</li>
  <li>Money counts from the <strong>day after the day Exit receives it</strong> (Indian Standard Time). For example, money received at any time on the 15th, up to midnight, counts from the 16th. Results before that day do not apply to it.</li>
  <li>Exit records each deposit in the Client's account in the Exit portal, with the date and time it was received.</li>
</ol>

<h2>4. Plan</h2>
<p>{{plan_terms}}</p>

<h2>5. Monthly cap</h2>
<ol>
  <li>The Client's maximum return in a month (the "Monthly Cap") is <strong>{{cap_pct}}%</strong> of the Capital in force on the 1st of that month.</li>
  <li>Capital that starts counting during a month adds to that month's Monthly Cap pro rata: {{cap_pct}}% × amount × (days left in the month from the day it starts counting, inclusive) ÷ (days in the month). Example: with a 6% cap, ₹50,000 counting from the 16th of a 30-day month adds ₹1,500.</li>
  <li>Each day's Trading Day Result is shared among clients in proportion to their Capital in force that day. Profit is credited to the Client only until the Monthly Cap is reached. Profit above every client's Monthly Cap belongs to Exit and the Partner. The Client has no claim to it.</li>
  <li>The Monthly Cap starts afresh on the 1st of every month.</li>
</ol>

<h2>6. Losses (Profit Share plan)</h2>
<ol>
  <li>A loss day reduces the Client's month result in proportion to the Client's Capital that day.</li>
  <li>If the month ends in a loss, nothing is paid for that month. The loss is carried forward and recovered from later months' results before any further payout.</li>
  <li>The Client's liability is limited to the Client's Capital. The Client never has to pay Exit more money because of trading losses.</li>
</ol>

<h2>7. Month close and payouts</h2>
<ol>
  <li>Exit closes each month on its last day. The month's results are then final and the payout for the month is worked out.</li>
  <li>Payouts are made only to the Registered Bank Account, within seven (7) working days after the month is closed.</li>
  <li>The Client can see daily results, payouts and account details in the Exit portal at any time. That record is the statement of account.</li>
</ol>

<h2>8. Withdrawals</h2>
<ol>
  <li>The Client may ask to withdraw any part of the Capital, less any loss being carried forward. A request can be cancelled until the month closes.</li>
  <li>The amount is paid with the payout for the month in which it is requested, and stops counting from the 1st of the next month.</li>
  <li>Withdrawing all of the Capital closes the account. Any loss being carried forward is then settled by paying out what is left of the Capital.</li>
</ol>

<h2>9. Emergency exit</h2>
<ol>
  <li>In an emergency the Client may ask to exit before the month ends. If Exit approves, the account is settled immediately on the results entered up to that time, and closes.</li>
  <li>Profit Share plan: Exit pays the Capital plus the month's result so far (a profit up to the Monthly Cap reached so far, or less the loss so far), less any loss carried forward, but never less than zero.</li>
  <li>Fixed Monthly Payout plan: Exit pays back the Capital in full. No payout is due for the part of the month before the exit.</li>
  <li>Exit may require all earlier months to be closed first. Results entered up to the exit are final for the Client.</li>
</ol>

<h2>10. Risk disclosure</h2>
<ol>
  <li>Trading in securities and derivatives involves substantial risk, including loss of Capital. Leverage can magnify losses.</li>
  <li>Results depend on market conditions outside Exit's control, including exchange or system failures, regulatory action and extreme price movements.</li>
  <li>The Client confirms they have read Exit's Risk Disclosure, can bear the loss of the Capital, and are not relying on any promise not written in this agreement.</li>
</ol>

<h2>11. KYC and anti-money laundering</h2>
<ol>
  <li>The Client confirms that the KYC documents and details given are true, complete and the Client's own, and will inform Exit of any change.</li>
  <li>The Client confirms that the Capital comes from lawful sources. Exit may verify identity and source of funds, and may refuse, hold or report transactions as required under the Prevention of Money Laundering Act, 2002 and related rules.</li>
</ol>

<h2>12. Personal data</h2>
<ol>
  <li>The Client consents to Exit collecting and using the Client's personal data (identity, contact, KYC, bank and account data) to run this agreement and meet legal obligations, as described in Exit's Privacy Policy, under the Digital Personal Data Protection Act, 2023.</li>
  <li>PAN, Aadhaar and bank account numbers are stored encrypted. The Client may ask Exit to access or correct their data, or to withdraw consent, subject to records Exit must keep by law.</li>
</ol>

<h2>13. Electronic acceptance</h2>
<p>The Client accepts this agreement electronically by signing in the Exit portal. Exit records the date, time, IP address and device of the signature and keeps the exact text signed. The parties agree this is a valid electronic record and signature under the Information Technology Act, 2000.</p>

<h2>14. The Partner</h2>
<ol>
  <li>The Partner introduces clients and assists them. The Partner cannot accept money, give any guarantee or change this agreement on Exit's behalf.</li>
  <li>Exit is not bound by any statement or promise by the Partner that is not in this agreement.</li>
</ol>

<h2>15. Taxes</h2>
<p>The Client is responsible for their own income tax on payouts. Exit will deduct tax at source where the law requires it and issue the certificates due.</p>

<h2>16. Death or incapacity</h2>
<p>On the Client's death or legal incapacity, Exit will close the account as at the last day of that month and pay the amount due to the nominee or legal heirs after receiving the documents Exit reasonably asks for.</p>

<h2>17. Termination</h2>
<ol>
  <li>The Client may end this agreement by withdrawing all of the Capital (clauses 8 and 9).</li>
  <li>Exit may end it with thirty (30) days' written notice, or immediately if the law requires it or the Client breaches clause 11. The Client is then paid what is due under clause 8.</li>
</ol>

<h2>18. Liability</h2>
<ol>
  <li>Exit is not liable for trading losses, or for delays or failures caused by events beyond its reasonable control (including exchange, bank or system outages, natural events or government action).</li>
  <li>Exit's liability under this agreement is limited to the amount due to the Client under it.</li>
  <li>The Client shall indemnify Exit against losses caused by false information or documents given by the Client.</li>
</ol>

<h2>19. Grievances</h2>
<p>Complaints may be sent to Exit's grievance officer at the contact details on Exit's website. Exit will acknowledge a complaint within two (2) working days and resolve it within fifteen (15) days.</p>

<h2>20. Disputes</h2>
<ol>
  <li>Any dispute arising from this agreement shall be referred to a sole arbitrator appointed by mutual agreement under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be Guntur, Andhra Pradesh, and the proceedings shall be in English.</li>
  <li>Subject to the above, the courts at Guntur, Andhra Pradesh have exclusive jurisdiction.</li>
</ol>

<h2>21. General</h2>
<ol>
  <li>This agreement is governed by the laws of India.</li>
  <li>Notices may be given through the Exit portal, by email or by SMS/WhatsApp to the Client's registered mobile number.</li>
  <li>Exit may amend this agreement by giving at least thirty (30) days' notice. The amended terms apply only once the Client accepts them or keeps Capital with Exit after the notice period. The Client may withdraw instead.</li>
  <li>If any part of this agreement is invalid, the rest remains in force. This agreement is the entire agreement between the parties on its subject and replaces any earlier agreement or understanding.</li>
</ol>
$html$);
