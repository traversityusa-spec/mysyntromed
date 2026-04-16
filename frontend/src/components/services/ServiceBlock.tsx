import React from 'react';
import { motion } from 'motion/react';
import { slideInLeft, slideInRight } from '@/lib/animations';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

interface ServiceBlockProps {
  id: string;
  icon: string;
  image: string;
  title: string;
  description: string;
  ideal: string[];
  reverse?: boolean;
}

export const ServiceBlock: React.FC<ServiceBlockProps> = ({ icon, image, title, description, ideal, reverse }) => {
  const IconComponent = (Icons as any)[icon];

  return (
    <section className="section-padding overflow-hidden">
      <div className={cn(
        "flex flex-col lg:flex-row items-center gap-8 md:gap-16",
        reverse && "lg:flex-row-reverse"
      )}>
        <motion.div
          variants={reverse ? slideInRight : slideInLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="w-full lg:w-[45%] aspect-[4/3] rounded-3xl overflow-hidden relative group shadow-2xl"
        >
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-teal-900/20 group-hover:bg-teal-900/10 transition-colors duration-500" />
          <div className="absolute bottom-6 left-6 w-14 h-14 bg-white/90 backdrop-blur-md text-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            {IconComponent && <IconComponent size={28} strokeWidth={2} />}
          </div>
        </motion.div>

        <motion.div
          variants={reverse ? slideInLeft : slideInRight}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="w-full lg:w-[60%] text-center lg:text-left"
        >
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 text-navy-900 leading-tight">{title}</h3>
          <p className="text-lg text-body mb-8 leading-relaxed">
            {description}
          </p>
          
          <div className="space-y-4">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Ideal for:</p>
            <div className="flex flex-wrap gap-2">
              {ideal.map((item, i) => (
                <Badge key={i} className="bg-white border-teal-100">{item}</Badge>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-teal-600 font-bold text-sm">
            <ShieldCheck size={18} />
            HIPAA-Compliant Workflow
          </div>
        </motion.div>
      </div>
    </section>
  );
};
