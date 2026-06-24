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
    },
    {
      quote: "The precision and care MySyntroMed brings to medical coding is unmatched. A true partner in healthcare.",
      author: "Dr. Benjamin",
      location: "Canada",
      image: "https://picsum.photos/seed/dr-benjamin/100/100"
    },
    {
      quote: "We've seen a 40% improvement in turnaround time since switching to MySyntroMed. Absolutely recommend.",
      author: "Dr. Chen",
      location: "China",
      image: "https://picsum.photos/seed/dr-chen/100/100"
    },
    {
      quote: "Outstanding compliance standards and seamless integration with our existing EHR system.",
      author: "Dr. David",
      location: "UK",
      image: "https://picsum.photos/seed/dr-david/100/100"
    },
    {
      quote: "MySyntroMed's AI-powered solutions have drastically reduced our documentation errors.",
      author: "Dr. Emily",
      location: "Australia",
      image: "https://picsum.photos/seed/dr-emily/100/100"
    },
    {
      quote: "Their round-the-clock support and expertise in medical transcription is second to none.",
      author: "Dr. Fatima",
      location: "UAE",
      image: "https://picsum.photos/seed/dr-fatima/100/100"
    },
    {
      quote: "A game-changer for our practice. MySyntroMed handles everything from coding to billing effortlessly.",
      author: "Dr. George",
      location: "Germany",
      image: "https://picsum.photos/seed/dr-george/100/100"
    },
    {
      quote: "Incredible attention to detail and patient data security. We trust MySyntroMed completely.",
      author: "Dr. Hannah",
      location: "Netherlands",
      image: "https://picsum.photos/seed/dr-hannah/100/100"
    },
    {
      quote: "MySyntroMed helped us scale our telehealth services without compromising on quality or turnaround.",
      author: "Dr. Isaac",
      location: "Israel",
      image: "https://picsum.photos/seed/dr-isaac/100/100"
    },
    {
      quote: "The reporting and analytics dashboard gives us insights we never had before. Highly recommended.",
      author: "Dr. Julia",
      location: "Brazil",
      image: "https://picsum.photos/seed/dr-julia/100/100"
    },
    {
      quote: "Fast, accurate, and HIPAA-compliant. MySyntroMed is the gold standard for medical documentation.",
      author: "Dr. Kevin",
      location: "Ireland",
      image: "https://picsum.photos/seed/dr-kevin/100/100"
    },
    {
      quote: "Our entire staff loves the intuitive platform. Training was effortless and the results speak for themselves.",
      author: "Dr. Laura",
      location: "Italy",
      image: "https://picsum.photos/seed/dr-laura/100/100"
    },
    {
      quote: "MySyntroMed's expertise in multispecialty coding has streamlined our revenue cycle management.",
      author: "Dr. Michael",
      location: "South Africa",
      image: "https://picsum.photos/seed/dr-michael/100/100"
    },
    {
      quote: "From onboarding to daily operations, MySyntroMed delivers excellence at every step.",
      author: "Dr. Nancy",
      location: "France",
      image: "https://picsum.photos/seed/dr-nancy/100/100"
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
