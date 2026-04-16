import { FAQAccordion } from '@/components/faq/FAQAccordion';
import { FooterCTA } from '@/components/home/FooterCTA';
import { motion } from 'motion/react';
import { Mail, PhoneCall } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/constants';

const FAQ = () => {
  return (
    <div className="flex flex-col bg-slate-50 min-h-screen pt-24">
      {/* Modern Split Layout Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        
        {/* Left Side: Sticky Intro & Contact */}
        <div className="lg:col-span-5 relative">
          <div className="lg:sticky lg:top-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100/50 text-teal-700 text-sm font-semibold mb-6">
                <span>Support Center</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 leading-tight mb-6 tracking-tight">
                Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-aqua-400">Questions</span>
              </h1>
              <p className="text-lg text-slate-500 mb-10 leading-relaxed">
                Everything you need to know about MySyntroMed's administrative services, HIPAA compliance, and our seamless onboarding process.
              </p>

              {/* Contact Card */}
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700 ease-out"></div>
                <h3 className="text-xl font-bold text-navy-900 mb-2 relative z-10">Can't find what you need?</h3>
                <p className="text-slate-500 mb-6 relative z-10 text-sm">Our support team is here to help you get the absolute best experience.</p>
                
                <div className="space-y-4 relative z-10">
                  <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-4 text-navy-900 hover:text-teal-600 transition-colors bg-slate-50 p-4 rounded-xl hover:bg-teal-50/50 group/btn">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover/btn:scale-110 transition-transform">
                      <Mail size={18} className="text-teal-600"/>
                    </div>
                    <span className="font-semibold">{CONTACT_INFO.email}</span>
                  </a>
                  <a href={`tel:${CONTACT_INFO.phone}`} className="flex items-center gap-4 text-navy-900 hover:text-teal-600 transition-colors bg-slate-50 p-4 rounded-xl hover:bg-teal-50/50 group/btn">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover/btn:scale-110 transition-transform">
                      <PhoneCall size={18} className="text-teal-600"/>
                    </div>
                    <span className="font-semibold">{CONTACT_INFO.phoneFormatted}</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Side: FAQs */}
        <div className="lg:col-span-7">
          <FAQAccordion />
        </div>
      </section>

      <FooterCTA />
    </div>
  );
};

export default FAQ;
