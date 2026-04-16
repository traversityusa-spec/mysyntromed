import { motion } from 'motion/react';
import { fadeUp, staggerContainer } from '@/lib/animations';
import { SectionLabel } from '@/components/ui/SectionLabel';

export const HowItWorksTeaser = () => {
  const steps = [
    { step: '01', title: 'Connect Your Practice', desc: 'Share your workflow, documentation, and patient communication needs.' },
    { step: '02', title: 'Meet Your Team', desc: 'We match trained, HIPAA-certified professionals to your practice.' },
    { step: '03', title: 'Focus on Patients', desc: 'Your MySyntroMed team handles operational work so you can concentrate on patient care.' },
  ];

  return (
    <section className="section-padding">
      <div className="text-center mb-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <SectionLabel>THE PROCESS</SectionLabel>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-navy-900 mb-6 leading-tight">Simple, secure, and effective</h2>
        </motion.div>
      </div>

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-12 relative"
      >
        {/* Connector line */}
        <div className="hidden lg:block absolute top-12 left-0 w-full h-px bg-dashed bg-teal-200 -z-10" />

        {steps.map((item, idx) => (
          <motion.div key={idx} variants={fadeUp} className="relative text-center group">
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.2 }}
              className="text-6xl md:text-8xl font-black text-teal-600 absolute -top-12 left-1/2 -translate-x-1/2 -z-10 transition-opacity"
            >
              {item.step}
            </motion.div>
            <h3 className="text-2xl mb-4 text-navy-900">{item.title}</h3>
            <p className="text-muted leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
