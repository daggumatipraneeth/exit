// Help drawer (opened from the account menu): plain-language answers for whoever is logged in.
import { Box, Drawer, IconButton, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { company } from '../config';

const bank = ['Why must the bank account be the one the money comes from?',
  'Exit pays every payout and withdrawal back to the same account the money came from, and to no other account. ' +
  'This keeps money safe from mistakes and fraud. If the customer sends money from a different account, update the bank details first.'];

const partner = [
  ['How do I add a customer?',
    'Customers → Add customer. Fill in the name, the 10-digit mobile number, the PAN and the bank details, plus the amount invested and the date it reached Exit. ' +
    'Aadhaar and document photos are optional for now. Save, then create the signing link and send it on WhatsApp. Exit approves once the customer signs.'],
  bank,
  ['The IFSC or account number is rejected. What now?',
    'IFSC is 11 characters: 4 letters, then a zero, then 6 letters or digits (e.g. SBIN0001234). People often type the letter O instead of the zero. ' +
    'The account number is 9 to 18 digits with no spaces. Copy both from the cheque book or passbook, and type the account number twice to catch typos.'],
  ['How does a customer add more money?',
    'They transfer it from their registered bank account. Tell the Exit office the amount and date; Exit updates the amount invested. ' +
    'Customers cannot add money from the app.'],
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
  ['How do I add more money?', 'Contact your partner. You cannot add money from the app.'],
  ['How do I change my bank account or mobile number?', 'Contact your partner. For your safety these can only be changed by Exit.'],
  ['I forgot my password.', 'Ask your partner to reset it. You can change it any time on this page.'],
];

const staff = [
  ['What happens at month end?',
    'Months → Close month works out each customer\'s payout: profit up to their cap (variable plan) or the fixed amount (fixed plan), plus any withdrawal. ' +
    'Then Download payout file and upload it to the bank. When the bank confirms, Mark paid.'],
  ['Variable or fixed plan?',
    'Variable: the customer gets the month\'s profit up to their cap; a loss carries forward and is recovered first. ' +
    'Fixed: the customer gets the cap every month, whatever the result; Exit absorbs any shortfall.'],
  ['Can I undo a month close?', 'Yes, Reopen, as long as it is not marked paid. Withdrawals go back to pending and capital is restored.'],
  ['The payout file says a customer has no bank details.', 'Add them on the customer\'s page (Bank account → Add), then download the file again.'],
  bank,
  ['How do I record a deposit?', 'On the customer\'s page, Capital → Change: enter the new total and the date the money arrived.'],
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
          {items.map(([q, a]) => (
            <Accordion key={q} disableGutters elevation={0} slotProps={{ transition: { timeout: 150 } }} sx={{ '&::before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 500 }}>{q}</Typography></AccordionSummary>
              <AccordionDetails><Typography color="text.secondary">{a}</Typography></AccordionDetails>
            </Accordion>
          ))}
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, mt: 2 }}>
            Still stuck? Call the Exit office on {company.phone}.
          </Typography>
        </Box>
      </Drawer>
    </>
  );
}
