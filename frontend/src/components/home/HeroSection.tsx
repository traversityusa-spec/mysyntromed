import { motion } from 'motion/react';
import { fadeUp, scaleIn } from '@/lib/animations';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';

const HeroParticles = React.lazy(() => import('@/components/three/HeroParticles'));

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-navy-900">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40"
        >
          <source 
            src="https://player.vimeo.com/external/449008903.sd.mp4?s=3404f3f18579482914589d7b42079036c84570f8&profile_id=164&oauth2_token_id=57447761" 
            type="video/mp4" 
          />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/80 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-20 md:py-32 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="lg:col-span-7"
        >
          <motion.div variants={fadeUp} className="mb-8">
            <Badge className="bg-teal-500 text-white border-transparent px-4 py-1.5 shadow-sm">
              <ShieldCheck size={14} className="mr-2" />
              HIPAA-Compliant Medical Support
            </Badge>
          </motion.div>
          
          <motion.h1 
            variants={fadeUp} 
            transition={{ delay: 0.1 }} 
            className="text-5xl md:text-8xl font-display font-extrabold tracking-tight text-white leading-[0.95] mb-8"
          >
            Support that keeps your <span className="text-teal-400 italic">practice moving</span>
          </motion.h1>
          
          <motion.p 
            variants={fadeUp} 
            transition={{ delay: 0.25 }} 
            className="text-lg md:text-xl text-slate-300 mb-12 leading-relaxed max-w-xl"
          >
            Hands-on, HIPAA-compliant medical support so you can focus on patients while we handle the rest.
          </motion.p>
          
          <motion.div 
            variants={fadeUp} 
            transition={{ delay: 0.4 }} 
            className="flex flex-col sm:flex-row gap-5 items-stretch sm:items-center"
          >
            <Button href="/contact" size="lg" className="rounded-full px-8 md:px-10 py-4 md:py-5 text-base md:text-lg shadow-xl shadow-teal-500/20 bg-teal-500 hover:bg-teal-600 border-none">
              Book Your Free Consultation
            </Button>
            <Link 
              to="/services" 
              className="group flex items-center justify-center sm:justify-start gap-3 text-white font-bold text-lg hover:text-teal-400 transition-colors px-4"
            >
              Explore Services
              <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center group-hover:border-teal-400 group-hover:bg-teal-400 group-hover:text-navy-900 transition-all">
                <Icons.ArrowRight size={20} />
              </div>
            </Link>
          </motion.div>

          <motion.div 
            variants={fadeUp} 
            transition={{ delay: 0.6 }}
            className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-8 md:gap-10"
          >
            <div className="flex flex-col">
              <span className="text-2xl md:text-3xl font-display font-bold text-white">98%</span>
              <span className="text-[10px] md:text-sm text-slate-400 uppercase tracking-widest font-bold">Accuracy Rate</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl md:text-3xl font-display font-bold text-white">24/7</span>
              <span className="text-[10px] md:text-sm text-slate-400 uppercase tracking-widest font-bold">Support Available</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl md:text-3xl font-display font-bold text-white">100%</span>
              <span className="text-[10px] md:text-sm text-slate-400 uppercase tracking-widest font-bold">HIPAA Compliant</span>
            </div>
          </motion.div>
        </motion.div>
        
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="lg:col-span-5 relative hidden lg:block"
        >
          <div className="relative z-10 rounded-[2.5rem] overflow-hidden shadow-2xl border-[12px] border-white/10 bg-white/5 backdrop-blur-sm">
            <img 
              src="/images/hero.jpg" 
              alt="Doctor consulting with patient" 
              className="w-full h-auto object-cover aspect-[4/5] opacity-90"
            />
          </div>
          
          {/* Floating Card */}
          <motion.div 
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-10 -left-10 bg-white p-8 rounded-3xl shadow-2xl z-20 border border-teal-50 max-w-[280px]"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-teal-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-teal-600/30">
                <Icons.UserCheck size={24} />
              </div>
              <div>
                <p className="text-lg font-bold text-navy-900 leading-tight">Expert Scribes</p>
                <p className="text-sm text-muted">Trained & Certified</p>
              </div>
            </div>
            <p className="text-sm text-body leading-relaxed">
              "MySyntroMed scribes have reduced my documentation time by 60%."
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
