import { motion } from 'motion/react';
import { scaleIn } from '@/lib/animations';
import { Button } from '@/components/ui/Button';

export const FooterCTA = () => {
  return (
    <section className="bg-navy-900 text-white py-24 relative overflow-hidden">
      {/* Subtle diagonal stripe pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ 
        backgroundImage: 'repeating-linear-gradient(45deg, #14b8a6 0, #14b8a6 1px, transparent 0, transparent 50%)',
        backgroundSize: '20px 20px'
      }} />

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-6xl mb-6 font-extrabold text-white">Reclaim your time today</h2>
          <p className="text-xl text-aqua-400/80 mb-12">
            Let MySyntroMed handle the administrative work so you can focus on patient care.
          </p>
          
          <motion.div
            initial={{ boxShadow: '0 0 0 rgba(20,184,166,0)' }}
            animate={{ boxShadow: ['0 0 0 rgba(20,184,166,0)', '0 0 20px rgba(20,184,166,0.4)', '0 0 0 rgba(20,184,166,0)'] }}
            transition={{ duration: 2, repeat: Infinity, delay: 3 }}
            className="inline-block rounded-lg"
          >
            <Button 
              href="/contact" 
              size="lg" 
              className="bg-white text-teal-700 hover:bg-aqua-400 hover:text-navy-900"
            >
              Schedule Your Free Consultation
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
