import { useState, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Send, Loader2, MapPin, Clock, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Phone, Mail } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/constants';

export const ContactForm = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    practiceName: '',
    email: '',
    phone: '',
    serviceInterest: '',
    message: '',
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/contact.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }

      setSubmitted(true);
      setFormData({
        fullName: '',
        practiceName: '',
        email: '',
        phone: '',
        serviceInterest: '',
        message: '',
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    { icon: Mail, label: 'Email Us', value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
    { icon: Phone, label: 'Call Us', value: CONTACT_INFO.phoneFormatted, href: `tel:${CONTACT_INFO.phone}` },
    { icon: MapPin, label: 'Location', value: 'United States', href: null },
    { icon: Clock, label: 'Response Time', value: 'Within 24 hours', href: null },
  ];

  return (
    <section className="section-padding bg-gradient-to-b from-neutral-50/50 to-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 text-navy-900 leading-tight">
            Start reclaiming your <span className="text-teal-600">time</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto">
            Ready to reduce your administrative burden? Fill out the form and we'll get back to you to schedule your free consultation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-4 space-y-6"
          >
            <div className="bg-navy-900 rounded-3xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
              <p className="text-slate-300 mb-8">We're here to help you streamline your practice. Reach out anytime.</p>
              
              <div className="space-y-5">
                {contactInfo.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-all">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="font-semibold hover:text-teal-400 transition-colors">{item.value}</a>
                      ) : (
                        <p className="font-semibold">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-teal-50 rounded-3xl p-8 border border-teal-100">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-teal-600 text-white rounded-xl flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <h3 className="text-lg font-bold text-navy-900">HIPAA Compliant</h3>
              </div>
              <p className="text-sm text-body leading-relaxed">
                All communications are secured and handled with strict confidentiality. Your data is protected.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-8"
          >
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-10 md:p-12 rounded-3xl shadow-xl border border-neutral-100 text-center"
                >
                  <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 size={40} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-navy-900">Request Received!</h2>
                  <p className="text-lg text-body mb-8 max-w-md mx-auto">
                    Thank you for reaching out. A member of our team will contact you shortly to schedule your consultation.
                  </p>
                  <Button onClick={() => setSubmitted(false)} variant="outline" className="rounded-full">
                    Send another message
                  </Button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-neutral-100 space-y-6"
                >
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">{error}</p>
                        <p className="text-sm text-red-600 mt-1">Please try again or contact us directly.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="fullName" className="text-sm font-bold text-navy-900">Full Name <span className="text-teal-600">*</span></label>
                      <input 
                        required 
                        id="fullName"
                        name="fullName"
                        type="text" 
                        value={formData.fullName}
                        onChange={handleChange}
                        className="w-full px-5 py-4 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all bg-neutral-50/50" 
                        placeholder="Dr. Sarah Johnson" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="practiceName" className="text-sm font-bold text-navy-900">Practice Name <span className="text-teal-600">*</span></label>
                      <input 
                        required 
                        id="practiceName"
                        name="practiceName"
                        type="text" 
                        value={formData.practiceName}
                        onChange={handleChange}
                        className="w-full px-5 py-4 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all bg-neutral-50/50" 
                        placeholder="City Medical Clinic" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-bold text-navy-900">Email Address <span className="text-teal-600">*</span></label>
                      <input 
                        required 
                        id="email"
                        name="email"
                        type="email" 
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-5 py-4 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all bg-neutral-50/50" 
                        placeholder="sarah@citymedical.com" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-bold text-navy-900">Phone Number</label>
                      <input 
                        id="phone"
                        name="phone"
                        type="tel" 
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-5 py-4 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all bg-neutral-50/50" 
                        placeholder="+1 (555) 123-4567" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="serviceInterest" className="text-sm font-bold text-navy-900">Services Interested In <span className="text-teal-600">*</span></label>
                    <select 
                      required 
                      id="serviceInterest"
                      name="serviceInterest"
                      value={formData.serviceInterest}
                      onChange={handleChange}
                      className="w-full px-5 py-4 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all bg-neutral-50/50"
                    >
                      <option value="">Select a service</option>
                      <option>Virtual Medical Scribes</option>
                      <option>Virtual Administrative Assistants</option>
                      <option>Virtual Receptionists</option>
                      <option>Patient Coordination Support</option>
                      <option>Multiple Services</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-bold text-navy-900">Tell us about your needs</label>
                    <textarea 
                      id="message"
                      name="message"
                      rows={4} 
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-5 py-4 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all h-32 resize-none bg-neutral-50/50" 
                      placeholder="Share details about your practice size, current challenges, and what you're hoping to achieve..."
                    ></textarea>
                  </div>

                  <Button type="submit" className="w-full py-5 text-lg rounded-xl" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" />
                        Sending your request...
                      </>
                    ) : (
                      <>
                        <Send size={18} className="mr-2" />
                        Book Your Free Consultation
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted">
                    By submitting this form, you agree to our privacy policy. We'll never share your information.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
