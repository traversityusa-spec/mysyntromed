import { useState, type FormEvent } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const Careers = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      fullName: String(data.get('full_name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      specialties: String(data.get('specialties') || '').trim(),
      experience: String(data.get('experience') || '').trim(),
      resumeLink: String(data.get('resume_link') || '').trim(),
      message: String(data.get('message') || '').trim(),
    };

    if (!payload.fullName || !payload.email) {
      setNotice('Please provide your name and email.');
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      await addDoc(collection(db, 'career_applications'), {
        ...payload,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Notify admins for review
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      await Promise.all(
        adminSnap.docs.map((adminDoc) =>
          addDoc(collection(db, 'notifications'), {
            userId: adminDoc.id,
            title: 'New Careers Application',
            message: `${payload.fullName} applied for a specialist role.`,
            type: 'system',
            read: false,
            createdAt: serverTimestamp(),
          })
        )
      );

      setSubmitted(true);
    } catch (err) {
      setNotice('Failed to submit application. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24">
      <div className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
          <h1 className="text-3xl font-bold text-navy-900">Careers at MySyntroMed</h1>
          <p className="mt-2 text-slate-600">
            Join our specialist network and support healthcare teams worldwide. Qualified applicants will receive onboarding instructions via the Specialist Portal.
          </p>

          {notice && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              {notice}
            </div>
          )}

          {submitted ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
              <p className="font-semibold">Application submitted!</p>
              <p className="text-sm mt-1">
                If you qualify, you’ll receive onboarding instructions to proceed through the Specialist Portal.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input name="full_name" type="text" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input name="phone" type="tel" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Years of Experience</label>
                  <input name="experience" type="text" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Specialties</label>
                <input name="specialties" type="text" placeholder="EHR Documentation, Patient Follow-Up, Scheduling"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Resume / Portfolio Link</label>
                <input name="resume_link" type="url" placeholder="https://"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Message</label>
                <textarea name="message" rows={4} placeholder="Tell us about your background..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Careers;
