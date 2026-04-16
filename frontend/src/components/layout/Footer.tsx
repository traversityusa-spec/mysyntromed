import { Link } from 'react-router-dom';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { NAV_LINKS, SERVICES, CONTACT_INFO } from '@/lib/constants';

export const Footer = () => {
  return (
    <footer className="bg-navy-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-6">
            <img src="/MySyntroMed-LM-AQUA.png" alt="MySyntroMed Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold tracking-tighter">MySyntroMed</span>
          </Link>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Hands-on, HIPAA-compliant medical support so you can focus on patients while we handle the rest.
          </p>
          <div className="flex items-center gap-4 mt-6">
            <img src="/images/hipaa-badge.png" alt="HIPAA Compliance Badge" className="h-12 w-auto opacity-90 hover:opacity-100 transition-opacity" />
            <img src="/images/mgma-badge.png" alt="MGMA Corporate Member" className="h-14 w-auto opacity-90 hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div>
          <h4 className="font-bold mb-6">Services</h4>
          <ul className="space-y-4 text-sm text-slate-400">
            {SERVICES.map(s => (
              <li key={s.id}>
                <Link to="/services" className="hover:text-aqua-400 transition-colors">{s.title}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-6">Company</h4>
          <ul className="space-y-4 text-sm text-slate-400">
            {NAV_LINKS.filter(l => l.href !== '/').map(l => (
              <li key={l.href}>
                <Link to={l.href} className="hover:text-aqua-400 transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-6">Contact</h4>
          <ul className="space-y-4 text-sm text-slate-400">
            <li className="flex items-center gap-3">
              <Mail size={16} className="text-aqua-400" />
              <a href={`mailto:${CONTACT_INFO.email}`} className="hover:text-aqua-400 transition-colors">{CONTACT_INFO.email}</a>
            </li>
            <li className="flex items-center gap-3">
              <Phone size={16} className="text-aqua-400" />
              <a href={`tel:${CONTACT_INFO.phone}`} className="hover:text-aqua-400 transition-colors">{CONTACT_INFO.phoneFormatted}</a>
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-aqua-400" />
              HIPAA Compliant
            </li>
          </ul>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <p>© 2026 MySyntroMed. All rights reserved.</p>
        <div className="flex gap-6">
          <button className="hover:text-white transition-colors">Privacy Policy</button>
          <button className="hover:text-white transition-colors">Terms of Service</button>
          <button className="hover:text-white transition-colors">HIPAA Statement</button>
        </div>
      </div>
    </footer>
  );
};
