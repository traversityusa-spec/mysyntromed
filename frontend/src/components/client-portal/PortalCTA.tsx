import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const PortalCTA = () => {
  return (
    <section className="section-padding bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-teal-400 font-bold text-sm uppercase tracking-wider mb-4">Client Portal</p>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
            Schedule a consultation to learn how MySyntroMed can support your practice with secure, reliable operational workflows.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              href="/contact" 
              size="lg" 
              className="rounded-full px-8 py-4 bg-teal-500 hover:bg-teal-600 border-none shadow-lg shadow-teal-500/25"
            >
              Get Started
            </Button>
            <Button 
              href="/services" 
              size="lg" 
              showArrow={false}
              variant="outline" 
              className="rounded-full px-8 py-4 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
            >
              Explore Services
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
