import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import { FAQS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { staggerContainer, fadeUp } from '@/lib/animations';

export const FAQAccordion = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="space-y-4"
    >
      {FAQS.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <motion.div 
            key={idx} 
            variants={fadeUp}
            className={cn(
              "rounded-2xl transition-all duration-300 border bg-white",
              isOpen 
                ? "border-teal-200 shadow-lg shadow-teal-900/5 ring-1 ring-teal-50" 
                : "border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
            )}
          >
            <button 
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full px-6 py-5 md:py-6 text-left flex justify-between items-center gap-4 group"
            >
              <span className={cn(
                "font-bold text-lg md:text-xl transition-colors pr-4",
                isOpen ? "text-teal-700" : "text-navy-900 group-hover:text-teal-600"
              )}>
                {faq.q}
              </span>
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                isOpen 
                  ? "bg-teal-600 text-white" 
                  : "bg-slate-50 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600"
              )}>
                {isOpen ? <Minus size={20} /> : <Plus size={20} />}
              </div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 pt-0 text-slate-500 leading-relaxed text-base md:text-lg">
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
