import { motion } from 'motion/react';
import { slideInLeft, slideInRight, staggerContainer, fadeUp } from '@/lib/animations';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';

export const WhyMySyntroMed = () => {
  const points = [
    { title: 'Trusted, human-powered support', desc: 'Real people, not just algorithms.' },
    { title: 'HIPAA-compliant workflows', desc: 'Security is our baseline standard.' },
    { title: 'Reliable and affordable', desc: 'Consistent help that fits your budget.' },
    { title: 'Scalable to your practice', desc: 'Grows as your patient list grows.' },
  ];

  return (
    <section className="bg-navy-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center py-16 md:py-24">
        <motion.div
          variants={slideInLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-8 text-white leading-tight">Every medical professional’s sidekick</h2>
          <p className="text-slate-400 text-lg mb-12 leading-relaxed">
            MySyntroMed seamlessly integrates into your practice, delivering human-powered support while maintaining strict HIPAA compliance. Reduce administrative workload, operate efficiently, and reclaim your time.
          </p>
          <Button 
            href="/how-it-works" 
            variant="outline" 
            className="border-white text-white hover:bg-white hover:text-teal-700"
          >
            See How It Works
          </Button>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-8"
        >
          {points.map((point, idx) => (
            <motion.div key={idx} variants={fadeUp} className="flex gap-4">
              <div className="shrink-0 w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center mt-1">
                <Check size={14} className="text-white" />
              </div>
              <div>
                <h4 className="font-bold mb-1 text-white">{point.title}</h4>
                <p className="text-sm text-slate-500">{point.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
