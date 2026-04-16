import { motion } from 'motion/react';

export const AnimatedDivider = () => (
  <motion.div
    className="h-px w-4/5 mx-auto bg-gradient-to-r from-transparent via-teal-300 to-transparent my-12"
    initial={{ scaleX: 0 }}
    whileInView={{ scaleX: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8, ease: 'easeOut' }}
  />
);
