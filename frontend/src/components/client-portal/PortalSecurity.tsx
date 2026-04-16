import { motion } from 'motion/react';
import { Database, Shield, Lock } from 'lucide-react';

export const PortalEHR = () => {
  return (
    <section className="section-padding bg-neutral-50/50">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="relative">
              <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center">
                    <Database size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-navy-900">Your EHR Systems</p>
                    <p className="text-sm text-muted">Patient data stays secure</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">A</div>
                    <span className="font-medium text-navy-900">Athenahealth</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-teal-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">F</div>
                    <span className="font-medium text-navy-900">Freed AI</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-purple-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">E</div>
                    <span className="font-medium text-navy-900">Epic / Other EHRs</span>
                  </div>
                </div>
              </div>
              
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-teal-400/20 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-teal-400/10 rounded-full blur-xl" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-navy-900 mb-6">
              Designed to Work Alongside Your EHR
            </h2>
            <p className="text-lg text-body leading-relaxed mb-6">
              The MySyntroMed portal does not store patient records or medical files. All patient documentation remains securely within your EHR systems.
            </p>
            <p className="text-lg text-body leading-relaxed">
              The portal simply provides a secure way for you to collaborate with your MySyntroMed specialist.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export const PortalSecurity = () => {
  return (
    <section className="section-padding">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:order-2"
          >
            <div className="bg-navy-900 rounded-3xl p-8 md:p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-[100px]" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center">
                    <Shield size={28} />
                  </div>
                  <h3 className="text-2xl font-bold">Security You Can Trust</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-teal-500/30 rounded-lg flex items-center justify-center shrink-0 mt-1">
                      <Lock size={16} className="text-teal-400" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">HIPAA Trained Specialists</p>
                      <p className="text-slate-300 text-sm">All specialists follow strict privacy protocols</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-teal-500/30 rounded-lg flex items-center justify-center shrink-0 mt-1">
                      <Lock size={16} className="text-teal-400" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Encrypted Communication</p>
                      <p className="text-slate-300 text-sm">Secure authentication protects your interactions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-teal-500/30 rounded-lg flex items-center justify-center shrink-0 mt-1">
                      <Lock size={16} className="text-teal-400" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">No Data Storage</p>
                      <p className="text-slate-300 text-sm">Patient data is never stored inside the portal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:order-1"
          >
            <p className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-4">Security</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-navy-900 mb-6">
              Security You Can Trust
            </h2>
            <p className="text-lg text-body leading-relaxed mb-6">
              MySyntroMed specialists are HIPAA trained and follow strict privacy protocols. The client portal uses secure authentication and encrypted communication to protect your practice interactions.
            </p>
            <p className="text-lg text-body leading-relaxed">
              Patient data is never stored inside the portal.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
