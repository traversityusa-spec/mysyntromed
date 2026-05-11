import { motion } from 'motion/react';
import { fadeUp, staggerContainer, cardHover } from '@/lib/animations';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SERVICES } from '@/lib/constants';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export const ServicesOverview = () => {
  return (
    <section className="section-padding bg-neutral-50/50">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <SectionLabel>OUR SERVICES</SectionLabel>
            <h2 className="text-4xl md:text-6xl font-display font-bold text-navy-900 mb-6">
              Reclaim your time with <span className="text-teal-600">MySyntroMed</span>
            </h2>
            <p className="text-lg md:text-xl text-muted leading-relaxed">
              We provide trained virtual professionals who manage documentation, administration, and patient coordination so healthcare teams can focus on what matters most—patients.
            </p>
          </motion.div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Button href="/services" variant="outline" className="rounded-full">
              View All Services
            </Button>
          </motion.div>
        </div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {/* Main Feature Card */}
          <motion.div
            variants={fadeUp}
            className="md:col-span-8 bg-white rounded-[2rem] p-6 md:p-10 border border-neutral-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative"
          >
            <div className="relative z-10 h-full flex flex-col">
              <div className="w-16 h-16 bg-teal-600 text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-teal-600/20">
                <Icons.ClipboardList size={32} />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-navy-900">Virtual Medical Scribes</h3>
              <p className="text-lg text-body leading-relaxed mb-8 max-w-md">
                Real-time documentation of patient encounters to ensure accuracy and efficiency. Our scribes work within your EMR to capture every detail.
              </p>
              <Link 
                to="/services" 
                className="mt-auto inline-flex items-center gap-2 text-teal-600 font-bold hover:gap-3 transition-all"
              >
                Explore Scribing <Icons.ArrowRight size={20} />
              </Link>
            </div>
            <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block">
              <img 
                src="/images/Virtual Medical Scribes.jpg" 
                alt="Nurse working" 
                className="w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white" />
            </div>
          </motion.div>

          {/* Side Card 1 */}
          <motion.div
            variants={fadeUp}
            className="md:col-span-4 bg-navy-900 rounded-[2rem] p-6 md:p-10 text-white shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-14 h-14 bg-teal-400 text-navy-900 rounded-2xl flex items-center justify-center mb-8">
                <Icons.Users size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Admin Support</h3>
              <p className="text-slate-400 leading-relaxed mb-8">
                Scheduling, records management, and workflow coordination.
              </p>
              <Link 
                to="/services" 
                className="inline-flex items-center gap-2 text-teal-400 font-bold hover:gap-3 transition-all"
              >
                Learn More <Icons.ArrowRight size={18} />
              </Link>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-teal-400/10 rounded-full blur-3xl" />
          </motion.div>

          {/* Bottom Card 1 */}
          <motion.div
            variants={fadeUp}
            className="md:col-span-4 bg-white rounded-[2rem] p-6 md:p-10 border border-neutral-100 shadow-sm hover:shadow-xl transition-all group"
          >
             <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-8">
               <Icons.MessageSquare size={28} />
             </div>
            <h3 className="text-2xl font-bold mb-4 text-navy-900">Virtual Receptionists</h3>
            <p className="text-muted leading-relaxed mb-8">
              Professional front-desk support and patient communication.
            </p>
            <Link 
              to="/services" 
              className="inline-flex items-center gap-2 text-teal-600 font-bold hover:gap-3 transition-all"
            >
              Learn More <Icons.ArrowRight size={18} />
            </Link>
          </motion.div>

          {/* Bottom Card 2 - With Image */}
          <motion.div
            variants={fadeUp}
            className="md:col-span-8 bg-teal-600 rounded-[2rem] p-6 md:p-10 text-white shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="relative z-10 h-full flex flex-col">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center mb-8">
                <Icons.TrendingUp size={28} />
              </div>
              <h3 className="text-3xl font-bold mb-4">Patient Coordination</h3>
              <p className="text-teal-50 leading-relaxed mb-8 max-w-md">
                Pre-visit preparation, follow-ups, and patient check-ins to ensure seamless care.
              </p>
              <Link 
                to="/services" 
                className="mt-auto inline-flex items-center gap-2 text-white font-bold hover:gap-3 transition-all"
              >
                Improve Outcomes <Icons.ArrowRight size={20} />
              </Link>
            </div>
            <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block">
              <img 
                src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=800" 
                alt="Healthcare team" 
                className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-teal-600" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
