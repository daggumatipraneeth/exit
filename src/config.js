// All business details live here. Replace the STUB values before going live.
export const company = {
  name: 'Exit Stock Broker Private Limited',
  short: 'Exit',
  tagline: 'Build wealth with clarity. Exit with confidence.',
  phone: '+91 99890 29916', // the one number for calls and WhatsApp, shown everywhere
  whatsapp: '919989029916', // digits only, with country code
  site: 'https://exitstocks.com',
  email: 'contact@exitstocks.com',
};

export const offices = [
  {
    city: 'Guntur',
    tag: 'Head Office',
    address: 'White House Apartments, Opp. Kundula Road, Brindavan Gardens, Guntur, Andhra Pradesh',
    hours: 'Mon – Sat · 9:00 AM – 6:30 PM',
    mapQuery: 'White House Apartments, Kundula Road, Brindavan Gardens, Guntur',
  },
  {
    city: 'Ongole',
    tag: 'Branch Office',
    address: 'Trunk Road, Opp. Studio & Croma Complex, Ongole, Andhra Pradesh',
    hours: 'Mon – Sat · 9:00 AM – 6:30 PM',
    mapQuery: 'Croma, Trunk Road, Ongole, Andhra Pradesh',
  },
  {
    city: 'Hyderabad',
    tag: 'Branch Office',
    address: '4th Floor, Stub Plaza, Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033', // STUB
    hours: 'Mon – Sat · 9:00 AM – 6:30 PM',
    mapQuery: 'Jubilee Hills, Hyderabad, Telangana',
  },
];

// Shown as "coming soon"; not offered on the contact form until they open (and added to office_names()).
export const upcoming = ['Nellore'];

export const stats = [
  { value: 12, suffix: '+', label: 'Years of market experience' }, // STUB
  { value: 5000, suffix: '+', label: 'Families advised' }, // STUB
  { value: 250, prefix: '₹', suffix: ' Cr+', label: 'Assets under advice' }, // STUB
  { value: offices.length, suffix: '', label: 'Offices across AP & Telangana' },
];

// What visitors can ask about on the contact form (also used when staff add a request).
export const interests = ['Stock Advisory', 'Mutual Funds / SIP', 'Portfolio Management', 'Wealth Management', 'Retirement Planning', 'Tax Planning', 'Insurance', 'Demat / IPO', 'Something else'];
