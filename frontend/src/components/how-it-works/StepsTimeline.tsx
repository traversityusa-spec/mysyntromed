import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Connect Your Practice',
    desc: 'Share your workflow, documentation, and patient communication needs. We conduct a thorough assessment to understand your specific requirements.',
    img: '/images/connect.jpg'
  },
  {
    step: '02',
    title: 'Meet Your Team',
    desc: 'We match trained, HIPAA-certified professionals to your practice. Our team members are selected based on their experience and fit for your specialty.',
    img: '/images/team.jpg'
  },
  {
    step: '03',
    title: 'Focus on Patients',
    desc: 'Your MySyntroMed team handles operational work so you can concentrate on patient care. We integrate seamlessly into your existing EMR and workflows.',
    img: '/images/Focus.jpg'
  },
];

export const StepsTimeline = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section ref={containerRef} className="section-padding relative">
      {/* Vertical Line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 -translate-x-1/2 hidden lg:block" />
      <motion.div 
        style={{ scaleY, originY: 0 }}
        className="absolute left-1/2 top-0 bottom-0 w-px bg-teal-600 -translate-x-1/2 hidden lg:block z-10"
      />

      <div className="space-y-16 md:space-y-32">
        {STEPS.map((item, idx) => (
          <div 
            key={idx} 
            className={cn(
              "flex flex-col lg:flex-row items-center gap-8 md:gap-16 relative",
              idx % 2 === 1 ? "lg:flex-row-reverse" : ""
            )}
          >
            {/* Step Number Circle */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white border-2 border-teal-600 rounded-full hidden lg:flex items-center justify-center z-20 font-bold text-teal-600">
              {item.step}
            </div>

            <motion.div 
              initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6 }}
              className="flex-1 text-center lg:text-left"
            >
              <div className="lg:hidden mb-6 inline-flex items-center justify-center w-12 h-12 bg-teal-600 text-white rounded-xl font-bold">
                {item.step}
              </div>
              <h2 className="text-3xl md:text-4xl mb-6 text-navy-900">{item.title}</h2>
              <p className="text-lg text-body leading-relaxed mb-8">{item.desc}</p>
              
              {idx === 2 && (
                <div className="p-6 bg-teal-50 rounded-2xl border border-teal-100 flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-teal-900 mb-1">Ready to go</h4>
                    <p className="text-sm text-teal-700">Most practices are fully integrated and operational within 3-5 business days.</p>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6 }}
              className="flex-1 w-full"
            >
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
                <img 
                  src={item.img} 
                  alt={item.title} 
                  className="w-full h-auto object-cover aspect-video" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
};
