// Help drawer (opened from the account menu): plain-language answers for whoever is logged in.
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { company } from '../config';
import { line } from '../theme';

const bank = ['Why must the bank account be the one the money comes from?',
  'Exit pays every payout and withdrawal back to the same account the money came from, and to no other account. ' +
  'This keeps money safe from mistakes and fraud. If the customer sends money from a different account, update the bank details first.'];

const cut = ['When does new money start counting?',
  'Money that reaches Exit before 12:00 noon counts from the next day; at or after 12:00 noon, from the day after. ' +
  'From then on it shares in each day\'s result, and adds to that month\'s bucket pro rata for the days left in the month.'];

const emergency = ['What is an emergency exit?',
  'If a customer needs their money before the month ends, they (or their partner) ask for an emergency exit and Exit pays it out straight away. ' +
  'Profit share: capital plus this month\'s result so far, less any loss carried from earlier months (never below zero). ' +
  'Fixed plan: capital in full, no payout for the part-month. The account then closes.'];

const partner = [
  ['How do I add a customer?',
    'Customers → Add customer. Fill in the name, the 10-digit mobile number, the PAN and the bank details, plus the amount invested and the date it reached Exit. ' +
    'Aadhaar and document photos are optional for now. Save, then create the signing link and send it on WhatsApp. Exit approves once the customer signs.'],
  bank,
  ['The IFSC or account number is rejected. What now?',
    'IFSC is 11 characters: 4 letters, then a zero, then 6 letters or digits (e.g. SBIN0001234). People often type the letter O instead of the zero. ' +
    'The account number is 9 to 18 digits with no spaces. Copy both from the cheque book or passbook, and type the account number twice to catch typos.'],
  ['How does a customer add more money?',
    'They transfer it from their registered bank account and you tell the Exit office the amount and the time it arrived. ' +
    'Money that arrives before 12:00 noon counts from the next day; from 12:00 noon, from the day after. ' +
    'That month\'s bucket grows pro rata: with a 6% cap, ₹50,000 counting from the 16th of a 30-day month adds ₹1,500. Customers cannot add money from the app.'],
  cut,
  emergency,
  ['How do I give a customer a login?',
    'Open the customer (approved customers only) → Customer login → Create login. Share the mobile number and temporary password privately. ' +
    'If they forget it, use Reset password on the same page.'],
  ['How do withdrawals work?',
    'The customer (or you, from their page) asks for an amount. It is paid with the next monthly payout, to their bank account. ' +
    'Withdrawing everything closes the account. A request can be cancelled until the month is closed.'],
];

const customer = [
  ['What is the daily figure?', 'Your share of that day\'s trading result, after charges. Green is profit, red is loss.'],
  ['When do I get paid?', 'After each month ends, Exit closes the month and sends your payout to your bank account. You see it here as "Processing", then "Paid".'],
  ['What happens in a loss month?', 'There is no payout that month. The loss is made up from the next months\' profit first, then payouts restart.'],
  ['How do I withdraw?', 'Use Request withdrawal and enter the amount. It is sent with the next monthly payout to your bank account. Withdrawing everything closes your account.'],
  ['I need my money now.', 'Use Request emergency exit. Exit pays you straight away instead of at month end: your capital plus this month\'s result so far (fixed plan: your capital in full), and your account closes.'],
  ['How do I add more money?', 'Transfer it from your registered bank account and tell your partner. Money that reaches Exit before 12:00 noon counts from the next day; after 12:00 noon, from the day after.'],
  ['How do I change my bank account or mobile number?', 'Contact your partner. For your safety these can only be changed by Exit.'],
  ['I forgot my password.', 'Ask your partner to reset it. You can change it any time on this page.'],
];

const staff = [
  ['What happens at month end?',
    'Each month closes automatically at 11:30 PM on its last day (or close it yourself that day from Months). Closing works out each customer\'s payout: ' +
    'profit up to their bucket (variable plan) or the bucket amount (fixed plan), plus any withdrawal. ' +
    'Then Download payout file and upload it to the bank. When the bank confirms, Mark paid. Buckets start fresh on the 1st.'],
  ['Variable or fixed plan?',
    'Variable: the customer gets the month\'s profit up to their cap; a loss carries forward and is recovered first. ' +
    'Fixed: the customer gets the cap every month, whatever the result; Exit absorbs any shortfall.'],
  ['Can I undo a month close?', 'Yes, Reopen, as long as it is not marked paid. Withdrawals go back to pending and capital is restored.'],
  ['The payout file says a customer has no bank details.', 'Add them on the customer\'s page (Bank account → Add), then download the file again.'],
  bank,
  ['How do I record a deposit?', 'On the customer\'s page, Capital → Add money: enter only the new amount and when it reached Exit\'s account. The dialog shows when it starts counting and how much it adds to this month\'s bucket.'],
  cut,
  emergency,
];

const byRole = { admin: staff, employee: staff, franchisee: partner, customer };

export default function Help({ role, open, onClose }) {
  const items = byRole[role] ?? [];
  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 } } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 1.5 }}>
          <Typography variant="h6" component="h2" sx={{ flex: 1 }}>Help</Typography>
          <IconButton aria-label="Close help" onClick={onClose}><CloseIcon /></IconButton>
        </Box>
        <Box sx={{ px: 1.5, pb: 2 }}>
          {/* Native <details>: opens instantly, even on slow phones (MUI's animated Accordion lagged there). */}
          {items.map(([q, a]) => (
            <Box
              component="details" key={q}
              sx={{
                borderBottom: `1px solid ${line}`,
                '& > summary': { display: 'flex', alignItems: 'center', gap: 1, listStyle: 'none', cursor: 'pointer', px: 2, py: 1.75, fontWeight: 500 },
                '& > summary::-webkit-details-marker': { display: 'none' },
                '&[open] > summary svg': { transform: 'rotate(180deg)' },
              }}
            >
              <summary><Box component="span" sx={{ flex: 1 }}>{q}</Box><ExpandMore sx={{ color: 'text.secondary' }} /></summary>
              <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>{a}</Typography>
            </Box>
          ))}
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, mt: 2 }}>
            Still stuck? Call the Exit office on {company.phone}.
          </Typography>
        </Box>
      </Drawer>
    </>
  );
}
