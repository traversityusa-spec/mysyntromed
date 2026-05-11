import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const PortalHero = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-400 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 w-full py-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Lock size={16} />
              Secure Client Portal
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-6">
              Your Practice. Your Support. <span className="text-teal-400">One Secure Portal.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed mb-10 max-w-lg">
              The MySyntroMed Client Portal makes it easy to communicate with your assigned specialist, request support, and stay updated on your practice operations. Everything in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                href="/portal" 
                size="lg" 
                className="rounded-full px-8 py-4 bg-teal-500 hover:bg-teal-600 border-none shadow-lg shadow-teal-500/25"
              >
                Login
              </Button>
              <Button 
                href="/contact" 
                size="lg" 
                variant="outline" 
                className="rounded-full px-8 py-4 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              >
                Request Access
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">SM</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">MySyntroMed Portal</p>
                      <p className="text-slate-400 text-xs">Welcome back, Dr. Johnson</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
                      <Lock size={14} className="text-teal-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">Messages</p>
                      <p className="text-slate-400 text-xs">2 unread</p>
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-teal-400 text-sm">📋</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">Requests</p>
                      <p className="text-slate-400 text-xs">3 in progress</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="absolute -bottom-6 -right-6 bg-navy-700 rounded-2xl p-4 shadow-xl border border-slate-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">All Systems</p>
                    <p className="text-slate-400 text-xs">Secure & Operational</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
