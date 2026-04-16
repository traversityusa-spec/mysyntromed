import { motion } from 'motion/react';
import { fadeIn, fadeUp } from '@/lib/animations';

interface PageHeroProps {
  title: string;
  description: string;
  eyebrow?: string;
}

export const PageHero = ({ title, description, eyebrow }: PageHeroProps) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-gradient-to-br from-teal-50/40 to-white">
      <div className="max-w-3xl mx-auto px-6 text-center">
        {eyebrow && (
          <motion.span
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="text-xs font-extrabold tracking-[0.2em] text-teal-600 uppercase mb-4 block"
          >
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-display font-bold mb-8 text-navy-900 leading-tight"
        >
          {title}
        </motion.h1>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.25 }}
          className="text-lg md:text-xl text-muted leading-relaxed"
        >
          {description}
        </motion.p>
      </div>
    </section>
  );
};
