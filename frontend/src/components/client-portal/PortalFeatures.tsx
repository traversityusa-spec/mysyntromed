import { motion } from 'motion/react';
import { MessageSquare, Headphones, Activity } from 'lucide-react';

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Direct Messaging',
    description: 'Communicate with your assigned specialist in real time. Ask questions, share instructions, or get updates on ongoing work.'
  },
  {
    icon: Headphones,
    title: 'Request Support',
    description: 'Submit requests such as chart preparation, administrative support, or patient follow-ups. Track progress from start to completion.'
  },
  {
    icon: Activity,
    title: 'Activity Updates',
    description: 'Stay informed with a clear record of completed tasks and ongoing work.'
  }
];

export const PortalFeatures = () => {
  return (
    <section className="section-padding">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold text-navy-900 mb-4">
            A Dedicated Workspace for Your Practice
          </h2>
          <p className="text-lg text-body max-w-3xl mx-auto">
            Every MySyntroMed client receives access to a private portal designed to make collaboration simple and efficient. Through the portal, you can communicate directly with your assigned specialist, request support, and stay informed about completed work without interrupting your workflow.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl p-8 border border-neutral-100 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-teal-600 group-hover:text-white transition-all">
                <feature.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">{feature.title}</h3>
              <p className="text-body leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
