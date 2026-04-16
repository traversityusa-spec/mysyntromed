import { motion } from 'motion/react';
import { fadeUp, staggerContainer, scaleIn } from '@/lib/animations';
import { ShieldCheck, Lock, UserCheck, Activity } from 'lucide-react';
import React, { Suspense } from 'react';

const FloatingOrb = React.lazy(() => import('@/components/three/FloatingOrb'));

export const TrustCompliance = () => {
  const badges = [
    { icon: <ShieldCheck className="text-teal-600" />, title: 'HIPAA-trained staff' },
    { icon: <Lock className="text-teal-600" />, title: 'Secure digital systems' },
    { icon: <UserCheck className="text-teal-600" />, title: 'Confidential support' },
    { icon: <Activity className="text-teal-600" />, title: 'Reliable workflows' },
  ];

  return (
    <section className="relative section-padding bg-gradient-to-b from-teal-50 to-white overflow-hidden">
      <Suspense fallback={null}>
        <FloatingOrb />
      </Suspense>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2 className="text-display mb-8">Your patients’ privacy is our priority</h2>
          <p className="text-muted text-lg mb-16 leading-relaxed">
            All MySyntroMed staff are HIPAA-certified, and our workflows are designed to protect patient information. We combine human support with secure processes to give you peace of mind.
          </p>
        </motion.div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {badges.map((badge, idx) => (
            <motion.div 
              key={idx}
              variants={scaleIn}
              className="bg-white rounded-xl p-6 border border-teal-100 shadow-sm flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                {badge.icon}
              </div>
              <h4 className="font-bold text-sm text-navy-900">{badge.title}</h4>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
