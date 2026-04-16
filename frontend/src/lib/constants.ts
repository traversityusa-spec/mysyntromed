export const CONTACT_INFO = {
  phone: '+13035320497',
  phoneFormatted: '+1 (303) 532-0497',
  email: 'info@mysyntromed.com',
};

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

export const SERVICES = [
  {
    id: 'scribes',
    title: 'Virtual Medical Scribes',
    description: 'Real-time documentation support during patient encounters to ensure accuracy and efficiency.',
    icon: 'ClipboardList',
    image: '/images/Virtual Medical Scribes.jpg',
    ideal: ['Solo Practitioners', 'Specialty Clinics', 'High-volume ERs']
  },
  {
    id: 'admin',
    title: 'Virtual Administrative Assistants',
    description: 'Operational support for scheduling, documentation management, and workflow coordination.',
    icon: 'Users',
    image: '/images/Virtual Administrative Assistants.jpg',
    ideal: ['Private Practices', 'Dental Offices', 'Therapy Groups']
  },
  {
    id: 'reception',
    title: 'Virtual Receptionists',
    description: 'Patient scheduling, phone support, and front desk communication with a human touch.',
    icon: 'PhoneCall',
    image: '/images/Virtual Receptionists.jpg',
    ideal: ['New Practices', 'Busy Front Desks', 'After-hours Support']
  },
  {
    id: 'coordination',
    title: 'Patient Coordination Support',
    description: 'Pre-visit preparation, follow-ups, and patient check-ins to ensure seamless care journeys.',
    icon: 'TrendingUp',
    image: '/images/patient support.jpg',
    ideal: ['Chronic Care', 'Post-Op Recovery', 'Preventative Care']
  }
];

export const FAQS = [
  {
    q: "Are MySyntroMed staff HIPAA-certified?",
    a: "Yes. All staff are HIPAA-trained and operate within secure, compliant workflows. We maintain strict standards for patient privacy and data protection."
  },
  {
    q: "Can MySyntroMed integrate with my existing systems?",
    a: "Yes. Our team adapts to the systems and processes already used within your practice, including major EHR and scheduling platforms."
  },
  {
    q: "Is MySyntroMed only for large practices?",
    a: "No. We work with practices of all sizes, from solo practitioners to multi-specialty clinics, providing scalable support."
  },
  {
    q: "How quickly can I get started?",
    a: "Most practices can onboard and begin receiving support within a few business days after the initial consultation."
  },
  {
    q: "Is support available internationally?",
    a: "Yes. Our team is trained to support medical professionals globally, adhering to relevant international standards."
  }
];

export const VALUES = [
  { title: 'Support First', desc: 'Healthcare professionals already carry the responsibility of patient care. MySyntroMed exists to support them.' },
  { title: 'Human Partnership', desc: 'Every MySyntroMed assistant works as an extension of your healthcare team, not just an external service.' },
  { title: 'Trust and Compliance', desc: 'Patient privacy and data protection are fundamental. MySyntroMed operates through HIPAA-compliant systems.' },
  { title: 'Reliability', desc: 'Support should never add stress. MySyntroMed delivers consistent and dependable assistance.' },
  { title: 'Efficiency', desc: 'By streamlining administrative work, MySyntroMed helps practices move faster and operate more smoothly.' },
];
