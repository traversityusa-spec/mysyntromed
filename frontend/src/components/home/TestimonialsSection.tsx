import { motion } from 'motion/react';
import { fadeUp, staggerContainer } from '@/lib/animations';
import { Quote } from 'lucide-react';

export const TestimonialsSection = () => {
  const testimonials = [
    {
      quote: "MySyntroMed has transformed my workflow. Their team is reliable, professional, and HIPAA-trained.",
      author: "Dr. Abibat",
      location: "USA",
      image: "https://picsum.photos/seed/dr-abibat/100/100"
    }
  ];

  return (
    <section className="bg-teal-50/50 py-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="text-center mb-16">
          <h2 className="text-display mb-4">Trusted by healthcare professionals</h2>
        </div>
        
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex justify-center"
        >
          {testimonials.map((t, idx) => (
            <motion.div 
              key={idx}
              variants={fadeUp}
              className="max-w-xl bg-white p-10 rounded-2xl shadow-sm border-l-4 border-teal-600 relative overflow-hidden"
            >
              <Quote className="absolute top-4 left-4 text-teal-100 w-16 h-16 -z-0" />
              <div className="relative z-10">
                <p className="text-xl italic text-body mb-8 leading-relaxed">
                  “{t.quote}”
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                    <img src={t.image} alt={t.author} referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="font-bold text-navy-900">{t.author}</p>
                    <p className="text-xs text-muted">{t.location}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
