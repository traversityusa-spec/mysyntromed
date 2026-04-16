import { motion } from 'motion/react';
import { slideInLeft, slideInRight, staggerContainer, fadeUp } from '@/lib/animations';
import { VALUES } from '@/lib/constants';
import { TrendingUp, Users, Heart } from 'lucide-react';

export const MissionVision = () => {
  return (
    <section className="section-padding">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
          variants={slideInLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-12"
        >
          <div className="border-l-4 border-teal-600 pl-8 py-4">
            <h2 className="text-3xl mb-6 flex items-center gap-3 font-display font-bold text-navy-900">
              <TrendingUp className="text-teal-600" /> Our Mission
            </h2>
            <p className="text-body text-lg leading-relaxed">
              To support healthcare professionals by removing operational and administrative burdens, so they can focus fully on patient care.
            </p>
          </div>

          <div className="border-l-4 border-teal-600 pl-8 py-4">
            <h2 className="text-3xl mb-6 flex items-center gap-3 font-display font-bold text-navy-900">
              <Users className="text-teal-600" /> Our Vision
            </h2>
            <p className="text-body text-lg leading-relaxed">
              A healthcare environment where medical professionals spend their time caring for patients while MySyntroMed ensures operational tasks run smoothly and securely.
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={slideInRight}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative"
        >
          <div className="rounded-3xl overflow-hidden shadow-2xl aspect-[4/5]">
            <img 
              src="/images/aboutimage.jpg" 
              alt="Medical team collaborating" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-teal-600 rounded-full -z-10 blur-2xl opacity-50" />
        </motion.div>
      </div>
    </section>
  );
};

export const ValuesGrid = () => {
  return (
    <section className="section-padding pt-0">
      <h2 className="text-display text-center mb-16">Our Values</h2>
      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {VALUES.map((val, idx) => (
          <motion.div 
            key={idx} 
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className={cn(
              "p-8 bg-white border border-teal-100 rounded-2xl shadow-sm transition-all hover:border-teal-400",
              idx >= 3 && "lg:col-span-1 lg:first:col-start-2" // Simple centering logic for 5 items
            )}
          >
            <Heart className="text-teal-600 w-6 h-6 mb-4" />
            <h4 className="font-bold text-navy-900 mb-4">{val.title}</h4>
            <p className="text-sm text-muted leading-relaxed">{val.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

import { cn } from '@/lib/utils';
