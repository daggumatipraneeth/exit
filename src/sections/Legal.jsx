// Terms of use, Privacy policy and Risk disclosure, shown at #/terms, #/privacy and #/risk.
// DRAFTS for legal review (see docs/LEGAL-REVIEW.md); the company details come from config.js.
import { Box, Container, Typography, Link, Stack } from '@mui/material';
import { company, offices } from '../config';
import { ink, line } from '../theme';

const updated = '13 October 2026';
const contact = `${company.email}, ${company.phone}, or ${offices[0].address}`;

export const legalDocs = {
  terms: {
    title: 'Terms of use',
    sections: [
      ['About these terms', [
        `These terms apply to your use of this website and Exit's client portal, run by ${company.name} ("Exit", "we"). By using them you agree to these terms. If you do not agree, please do not use them.`,
      ]],
      ['Information, not advice', [
        'Content on this website, including the SIP calculator and the risk profile quiz, is general information and illustration only. It is not investment, tax or legal advice, and not an offer or solicitation to buy or sell any security.',
        'Any service is provided only under a written agreement signed with Exit, after KYC. Read our Risk disclosure before investing.',
      ]],
      ['Your account', [
        'Portal logins are personal. Keep your password secret and change the temporary password you are given at your first login. Tell us at once if you think someone else has used your account.',
        'You are responsible for the accuracy of the information and documents you give us.',
      ]],
      ['Acceptable use', [
        'Do not misuse the website or portal: no attempts to access other people\'s data, to interfere with the service, to send automated or false requests, or to copy content for commercial use.',
      ]],
      ['Availability and accuracy', [
        'We try to keep the website and portal accurate and available, but do not promise they will be error-free or uninterrupted. The figures in your signed agreement and in the portal\'s statements prevail over anything else on the website.',
      ]],
      ['Liability', [
        'To the extent the law allows, Exit is not liable for loss arising from use of the general information on this website. Nothing in these terms limits rights you have under the Consumer Protection Act, 2019 or other law that cannot be limited.',
      ]],
      ['Intellectual property', [
        'The Exit name, logo and the content of this website belong to Exit. You may view and print pages for personal use.',
      ]],
      ['Law and disputes', [
        'These terms are governed by the laws of India. Courts at Guntur, Andhra Pradesh have jurisdiction. Disputes under a client agreement follow the dispute clause in that agreement.',
      ]],
      ['Changes and contact', [
        `We may update these terms; the date above shows the latest version. Questions: ${contact}.`,
      ]],
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: [
      ['Who we are', [
        `${company.name} is the data fiduciary for the personal data described here, under the Digital Personal Data Protection Act, 2023 ("DPDP Act").`,
      ]],
      ['What we collect', [
        'Website contact form: your name, phone number, email (optional), preferred office, interest and message, and the IP address the request came from (to stop spam).',
        'Clients: identity and KYC details (name, PAN, Aadhaar last 4 digits, date of birth, address, photos of KYC documents), contact details, bank account details, the signed agreement with the date, time, IP address and device of signing, and your investment records (deposits, daily results, payouts, withdrawals).',
      ]],
      ['Why we use it', [
        'To answer your enquiry; to open and run your account under your agreement; to pay you; to meet legal obligations including KYC and anti-money-laundering rules under the Prevention of Money Laundering Act, 2002, tax law and regulators\' requirements; and to prevent fraud.',
        'We do not sell your data and do not use it for advertising.',
      ]],
      ['Consent', [
        'We process your data with your consent, given when you submit the contact form or sign the client agreement, and where the law otherwise permits. You may withdraw consent at any time by contacting us. Withdrawal does not affect processing already done, and we may need to keep records the law requires.',
      ]],
      ['Who we share it with', [
        'Only as needed: our bank (to make payouts), the partner who introduced you (your name, contact and account figures, never your PAN, Aadhaar or full bank account number), our technology providers who host the portal under confidentiality obligations, and authorities when the law requires.',
        'Our hosting provider may store data on servers in India or abroad, subject to the DPDP Act and any restrictions notified under it.',
      ]],
      ['How long we keep it', [
        'Contact form requests: up to 2 years. Client records: for the life of the account and at least 5 years after it closes, or longer if a law, regulator or dispute requires.',
      ]],
      ['How we protect it', [
        'PAN, Aadhaar, bank account numbers, KYC photos and signed agreements are stored encrypted. Access is limited by role, every change is logged, and records are never deleted while they must be kept.',
      ]],
      ['Your rights', [
        'Under the DPDP Act you may ask to access a summary of your data, correct or complete it, have it erased where we are no longer required to keep it, nominate someone to exercise your rights if you die or cannot act, and raise a grievance. Contact us as below; we respond within 30 days.',
        'If you are not satisfied with our response, you may complain to the Data Protection Board of India.',
      ]],
      ['Children', [
        'Our services are for adults. We do not knowingly collect data of anyone under 18 without verifiable parental consent.',
      ]],
      ['Third-party content', [
        'The office map on this website is provided by Google Maps; Google\'s privacy policy applies to it. This website does not use advertising or tracking cookies.',
      ]],
      ['Grievance officer and contact', [
        `For privacy requests and grievances: ${contact}. We acknowledge within 2 working days.`,
      ]],
    ],
  },
  risk: {
    title: 'Risk disclosure',
    sections: [
      ['Please read before investing', [
        'Investments in the securities market are subject to market risks. Read all related documents carefully before investing. You can lose some or all of the money you invest.',
      ]],
      ['Market risk', [
        'Prices of shares, derivatives and other securities move with markets, the economy, company results, interest rates, government policy and events no one can predict. Losses can happen on any day, and in any month.',
      ]],
      ['Derivatives and leverage', [
        'Trading in futures and options uses leverage: a small price move can cause a large loss, larger than the margin placed. SEBI studies have found that most individual traders in equity derivatives lose money.',
      ]],
      ['No guaranteed returns', [
        'Past results are not a guide to future results. Figures on this website, including the SIP calculator, are illustrations, not promises. No one at Exit or among our partners may promise you a return that is not written in your signed agreement.',
      ]],
      ['How returns are shared at Exit', [
        'Under the Profit Share plan your monthly return is capped at the percentage in your agreement; profit above the cap is not yours. A loss is carried forward and recovered from later profits before any further payout. Results are shown after all trade charges (brokerage, taxes and regulatory levies).',
      ]],
      ['Liquidity and timing', [
        'Withdrawals are paid at month end. An emergency exit is possible but settles on the results at that time, which may be a loss. Market conditions such as circuit limits or exchange outages can delay trading or exit.',
      ]],
      ['Operational and regulatory risk', [
        'Technology failures, errors by brokers, exchanges or banks, and changes in law, tax or regulation can affect results and payouts.',
      ]],
      ['Suitability', [
        'Invest only money you can afford to lose and do not need at short notice. If you are unsure, take independent advice.',
      ]],
      ['Questions', [`Contact us: ${contact}.`]],
    ],
  },
};

export default function Legal({ doc }) {
  const d = legalDocs[doc];
  return (
    <Box component="main" sx={{ bgcolor: '#fff', pt: { xs: 12, md: 16 }, pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="md">
        <Link href="#top" underline="hover" sx={{ fontWeight: 500 }}>← Back to home</Link>
        <Typography variant="h3" component="h1" sx={{ mt: 2, color: ink, fontSize: { xs: '2rem', md: '2.6rem' } }}>{d.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{company.name} · Last updated {updated}</Typography>
        <Stack spacing={4} sx={{ mt: 5 }}>
          {d.sections.map(([heading, paras]) => (
            <Box key={heading} component="section">
              <Typography variant="h6" component="h2" sx={{ color: ink, mb: 1 }}>{heading}</Typography>
              {paras.map((p) => <Typography key={p} sx={{ mb: 1.5, lineHeight: 1.75, color: 'text.secondary' }}>{p}</Typography>)}
            </Box>
          ))}
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 6, pt: 3, borderTop: `1px solid ${line}`, flexWrap: 'wrap' }}>
          {Object.entries(legalDocs).filter(([k]) => k !== doc).map(([k, v]) => <Link key={k} href={`#/${k}`} underline="hover">{v.title}</Link>)}
        </Stack>
      </Container>
    </Box>
  );
}
