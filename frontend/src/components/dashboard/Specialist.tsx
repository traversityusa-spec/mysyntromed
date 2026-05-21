import { Link } from 'react-router-dom';
import { Calendar, Check, Clock, Mail, MessageSquare, Phone, Star, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { ratingService, userService, requestService, notificationService, type SpecialistRating, type UserProfile, type AppNotification } from '@/lib/firestore';

const DEFAULT_SPECIALTIES = [
    'EHR Documentation',
    'Medical Chart Prep',
    'Patient Follow-Up',
    'Insurance Verification',
    'Appointment Scheduling',
    'HIPAA Compliance',
  ];

const Specialist = () => {
  const { sessionUser, refreshSessionUser } = useAuth();
  const hasAssignment = !!sessionUser?.assignedSpecialistId;
  const assignedName = sessionUser?.assignedSpecialistName || 'Pending Assignment';
  const [specialistProfile, setSpecialistProfile] = useState<UserProfile | null>(null);
  const [ratings, setRatings] = useState<SpecialistRating[]>([]);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [assignmentNotification, setAssignmentNotification] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (!sessionUser?.assignedSpecialistId) {
      setSpecialistProfile(null);
      setRatings([]);
      return;
    }
    userService.getProfile(sessionUser.assignedSpecialistId).then(setSpecialistProfile).catch(() => {});
    const unsub = ratingService.subscribeToRatings(sessionUser.assignedSpecialistId, setRatings);
    return () => unsub();
  }, [sessionUser?.assignedSpecialistId]);

  useEffect(() => {
    if (!sessionUser?.uid) return;
    const unsub = notificationService.subscribeToNotifications(sessionUser.uid, (items) => {
      const assignmentNotif = items.find(
        n => n.type === 'assignment' && !n.read
      );
      if (assignmentNotif) {
        setAssignmentNotification(assignmentNotif);
      }
    });
    return () => unsub();
  }, [sessionUser?.uid]);

  useEffect(() => {
    if (sessionUser?.assignedSpecialistId && sessionUser?.assignedSpecialistName) {
      setRequestSent(true);
      setRequestNotice('You have been assigned a specialist. You can now message them for assistance.');
    }
  }, [sessionUser?.assignedSpecialistId, sessionUser?.assignedSpecialistName]);

  const dismissAssignmentNotification = async () => {
    if (assignmentNotification) {
      await notificationService.markNotificationRead(assignmentNotification.id);
    }
    setAssignmentNotification(null);
    await refreshSessionUser();
  };

  const averageRating = useMemo(() => {
    if (!ratings.length) return 0;
    return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  }, [ratings]);

  return (
    <div className="space-y-6">
      {assignmentNotification && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <Check size={20} />
                {assignmentNotification.title}
              </h2>
              <p className="mt-2 text-sm text-emerald-800">
                {assignmentNotification.message}
              </p>
            </div>
            <button
              onClick={dismissAssignmentNotification}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <MessageSquare size={16} />
              Message Specialist
            </button>
          </div>
        </div>
      )}
      {!hasAssignment && !requestSent && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Welcome — Request a Specialist</h2>
          <p className="mt-2 text-sm text-amber-800">
            You don't have a specialist assigned yet. Send a request and an admin will assign one for you.
          </p>
          <div className="mt-4 space-y-3">
            <textarea
              rows={3}
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Tell us about your needs (optional)"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                if (!sessionUser?.uid) return;
                setSubmitting(true);
                setRequestNotice(null);
                try {
                  await requestService.createRequest({
                    userId: sessionUser.uid,
                    type: 'Specialist Assignment',
                    description: requestNote.trim() || 'Requesting a specialist assignment.',
                    priority: 'normal',
                    clientName: sessionUser.displayName || sessionUser.email || 'Client',
                    clientEmail: sessionUser.email || '',
                  });
                  setRequestSent(true);
                  setRequestNotice('Request submitted. An admin will assign a specialist soon.');
                } catch (error) {
                  console.error('Failed to submit specialist request', error);
                  const err = error as { message?: string; code?: string };
                  const msg = err?.message;
                  const code = err?.code;
                  const detail = msg || code;
                  setRequestNotice(detail ? `Request failed: ${detail}` : 'Request failed. Please try again.');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  Submitting...
                </>
              ) : (
                'Request Specialist'
              )}
            </button>
            {requestNotice && (
              <p className="text-sm text-amber-800 font-medium">{requestNotice}</p>
            )}
          </div>
        </div>
      )}
      {!hasAssignment && requestSent && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
            <Clock size={20} />
            Request Pending
          </h2>
          <p className="mt-2 text-sm text-emerald-800">
            {requestNotice || 'Your specialist request has been submitted. An admin will assign a specialist to you shortly. You will be notified once assigned.'}
          </p>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-teal-700 md:h-32 md:w-32">
            {specialistProfile?.photoURL ? (
              <img src={specialistProfile.photoURL} alt={assignedName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold md:text-5xl">{assignedName.charAt(0)}</span>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-navy-900">{assignedName}</h1>
                <p className="mt-1 text-slate-600">{specialistProfile?.role || 'Medical Scribe Specialist'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={i < Math.floor(averageRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                      />
                    ))}
                    <span className="ml-1 text-sm font-medium text-slate-700">
                      {averageRating > 0 ? averageRating.toFixed(1) : 'N/A'}
                    </span>
                    <span className="text-sm text-slate-500">({ratings.length} reviews)</span>
                  </div>
                </div>
              </div>

               <div className="flex flex-wrap gap-2">
                 <Link
                   to="/portal/messages"
                   className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                     hasAssignment ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                   }`}
                 >
                   <MessageSquare size={16} />
                   Message
                 </Link>
               </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Check size={14} className="text-emerald-500" />
                {specialistProfile?.yearsExperience ? `${specialistProfile.yearsExperience}+ years` : ''} experience
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-navy-900">About</h2>
            <p className="mt-3 text-slate-600">{specialistProfile?.bio || 'No bio available.'}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-navy-900">Specialties</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(specialistProfile?.specialties?.length ? specialistProfile.specialties : DEFAULT_SPECIALTIES).map((specialty) => (
                <div
                  key={specialty}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <Check size={14} />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{specialty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-navy-900">Quick Actions</h2>
            <div className="mt-4 space-y-3">
              <Link
                to="/portal/messages"
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
              >
                <MessageSquare size={18} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Send a Message</span>
              </Link>
<Link
                 to="/portal/requests"
                 className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
               >
                 <Clock size={18} className="text-slate-400" />
                 <span className="text-sm font-medium text-slate-700">Submit a Request</span>
               </Link>
             </div>
          </div>

          {hasAssignment && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-navy-900">Rate Your Specialist</h2>
              <p className="mt-2 text-sm text-slate-600">Share your feedback to help improve care coordination.</p>
              <div className="mt-4 flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRatingValue(i + 1)}
                    className="text-amber-400"
                  >
                    <Star size={20} className={i < ratingValue ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                  </button>
                ))}
                <span className="text-xs text-slate-500">{ratingValue ? `${ratingValue}/5` : 'Select a rating'}</span>
              </div>
              <textarea
                rows={3}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Optional comment"
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="button"
                disabled={!ratingValue || submitting}
                onClick={async () => {
                  if (!sessionUser?.assignedSpecialistId || !sessionUser?.uid || !ratingValue) return;
                  setSubmitting(true);
                  try {
                    await ratingService.submitRating({
                      specialistId: sessionUser.assignedSpecialistId,
                      clientId: sessionUser.uid,
                      rating: ratingValue,
                      comment: ratingComment.trim() || undefined,
                    });
                    setRatingValue(0);
                    setRatingComment('');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="mt-3 w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
            <h2 className="text-lg font-semibold text-navy-900">Contact Info</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{specialistProfile?.email || 'Available via portal'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">Available via portal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Specialist;
