import { type FormEvent, useState } from 'react';
import { AlertTriangle, Check, Clock, Eye, ListTodo, Plus, RefreshCw, X, Calendar, User, Mail, FileText, ChevronRight } from 'lucide-react';
import { useRequests } from '@/lib/dashboard';
import { ErrorBoundary } from '../ErrorBoundary';
import type { Request } from '@/lib/firestore';
import { requestService } from '@/lib/firestore';
import { useAuth } from '@/lib/AuthContext';

const requestTypes = [
  'Chart Prep',
  'Patient Follow-Up',
  'Appointment Scheduling',
  'Insurance Verification',
  'Administrative Task',
  'Other',
];

const suggestedTasks: Record<string, string[]> = {
  'Chart Prep': ['Prepare charts for tomorrow', 'Update patient information', 'Review medication lists'],
  'Patient Follow-Up': ['Call patients for follow-up', 'Send reminder messages', 'Schedule follow-up appointments'],
  'Appointment Scheduling': ['Schedule new appointments', 'Reschedule existing appointments', 'Confirm patient appointments'],
  'Insurance Verification': ['Verify insurance coverage', 'Check eligibility', 'Submit prior authorization'],
  'Administrative Task': ['Update patient records', 'Process paperwork', 'Coordinate with billing'],
  Other: [],
};

const priorityColors = {
  normal: 'bg-slate-100 text-slate-600',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const statusIcons = {
  pending: Clock,
  in_progress: RefreshCw,
  completed: Check,
};

const statusColors = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

const Requests = () => {
  const { sessionUser } = useAuth();
  const { requests, loading, createRequest, refreshRequests } = useRequests();
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [preferredTime, setPreferredTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSpecialist = sessionUser?.role === 'specialist';

  const handleStatusChange = async (requestId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      await requestService.updateRequestStatus(requestId, newStatus);
      refreshRequests();
      setSelectedRequest((prev) => prev ? { ...prev, status: newStatus, completedAt: newStatus === 'completed' ? new Date() : prev.completedAt } : null);
    } catch (e) {
      console.error('Error updating request status:', e);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedType || !description) return;

    setSubmitting(true);
    setError(null);
    
    try {
      await createRequest({
        type: selectedType,
        description,
        priority,
        preferredTime,
      });
      setSubmitted(true);
      setTimeout(() => {
        setShowForm(false);
        setSubmitted(false);
        setSelectedType('');
        setDescription('');
        setPriority('normal');
        setPreferredTime('');
      }, 2000);
    } catch (err) {
      const error = err as { message?: string; code?: string };
      const detail = error?.message || error?.code;
      setError(detail ? `Failed to submit request: ${detail}` : 'Failed to submit request. Please try again.');
      console.error('Error creating request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
    return <Icon size={14} className={status === 'in_progress' ? 'animate-spin' : ''} />;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Requests</h1>
          <p className="mt-1 text-slate-600">Submit and track your support requests</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus size={18} />
          Create New Request
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">Create New Request</h2>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Request Submitted!</h3>
              <p className="mt-1 text-sm text-slate-500">Your specialist will begin working on it shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Request Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                >
                  <option value="">Select a request type</option>
                  {requestTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {selectedType && suggestedTasks[selectedType]?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Suggested tasks:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTasks[selectedType].map((task) => (
                      <button
                        key={task}
                        type="button"
                        onClick={() => setDescription(task)}
                        className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                      >
                        {task}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe what you need help with..."
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
                  <div className="flex gap-2">
                    {(['normal', 'high', 'urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          priority === p
                            ? p === 'urgent'
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : p === 'high'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-teal-300 bg-teal-50 text-teal-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p === 'urgent' && <AlertTriangle size={14} className="mr-1 inline" />}
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Preferred Completion Time</label>
                  <input
                    type="text"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    placeholder="e.g., Today by 5 PM"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedType || !description}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">Requests List</h2>
            <button
              onClick={() => refreshRequests()}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : requests && requests.length > 0 ? (
          <><div className="hidden sm:block">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Request
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Date Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Specialist
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => {
                  const reqPriority = typeof request.priority === 'string' ? request.priority.toLowerCase() : 'normal';
const reqStatus = typeof request.status === 'string' ? request.status.toLowerCase() : 'pending';
                   
                   return (
                   <tr 
                    key={request.id} 
                    onClick={() => setSelectedRequest(request)}
                    className="cursor-pointer hover:bg-slate-50"
                   >
                     <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                          <ListTodo size={18} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{typeof request.type === 'string' ? request.type : 'Request'}</p>
                          <p className="text-sm text-slate-500">{typeof request.description === 'string' ? request.description : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {formatDate(request.submittedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[reqPriority as keyof typeof priorityColors] || priorityColors.normal}`}
                      >
                        {reqPriority === 'urgent' && <AlertTriangle size={10} />}
                        {reqPriority.charAt(0).toUpperCase() + reqPriority.slice(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {isSpecialist ? (
                        <select
                          value={request.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(request.id, e.target.value as 'pending' | 'in_progress' | 'completed');
                          }}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-medium outline-none ${
                            request.status === 'completed'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : request.status === 'in_progress'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[reqStatus as keyof typeof statusColors] || statusColors.pending}`}
                        >
                          {getStatusIcon(reqStatus as any)}
                          {reqStatus === 'in_progress'
                            ? 'In Progress'
                            : reqStatus.charAt(0).toUpperCase() + reqStatus.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span>{request.specialistName || 'Unassigned'}</span>
                        {request.seen && (
                          <span className="inline-flex max-w-fit items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                            <Eye size={10} />
                            Viewed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
            </div>

          <div className="space-y-3 sm:hidden">
            {requests.map((request) => {
              const reqPriority = typeof request.priority === 'string' ? request.priority.toLowerCase() : 'normal';
              const reqStatus = typeof request.status === 'string' ? request.status.toLowerCase() : 'pending';
              return (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-teal-200 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-900">{typeof request.type === 'string' ? request.type : 'Request'}</p>
                    {isSpecialist ? (
                      <select
                        value={request.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(request.id, e.target.value as 'pending' | 'in_progress' | 'completed');
                        }}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-medium outline-none ${
                          request.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : request.status === 'in_progress'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[reqStatus as keyof typeof statusColors] || statusColors.pending}`}>
                        {getStatusIcon(reqStatus as any)}
                        {reqStatus === 'in_progress' ? 'In Progress' : reqStatus.charAt(0).toUpperCase() + reqStatus.slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{typeof request.description === 'string' ? request.description : ''}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{formatDate(request.submittedAt)}</span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColors[reqPriority as keyof typeof priorityColors] || priorityColors.normal}`}>
                        {reqPriority === 'urgent' && <AlertTriangle size={10} />}
                        {reqPriority.charAt(0).toUpperCase() + reqPriority.slice(1)}
                      </span>
                      <span>{request.specialistName || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <ListTodo size={48} className="mb-4 text-slate-300" />
            <p className="text-lg font-medium">No requests yet</p>
            <p className="mt-1 text-sm">Create your first request to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              <Plus size={16} />
              Create Request
            </button>
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy-900">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{selectedRequest.type}</p>
                  <p className="text-sm text-slate-500">{selectedRequest.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Calendar size={12} />
                    Date Submitted
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(selectedRequest.submittedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {selectedRequest.completedAt && (
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Check size={12} />
                      Completed
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(selectedRequest.completedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <AlertTriangle size={12} />
                    Priority
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      selectedRequest.priority === 'urgent'
                        ? 'bg-red-100 text-red-700'
                        : selectedRequest.priority === 'high'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedRequest.priority === 'urgent' && <AlertTriangle size={10} />}
                    {selectedRequest.priority.charAt(0).toUpperCase() + selectedRequest.priority.slice(1)}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock size={12} />
                    Status
                  </div>
                  {isSpecialist ? (
                    <select
                      value={selectedRequest.status}
                      onChange={(e) => handleStatusChange(selectedRequest.id, e.target.value as 'pending' | 'in_progress' | 'completed')}
                      className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                        selectedRequest.status === 'completed'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : selectedRequest.status === 'in_progress'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        selectedRequest.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : selectedRequest.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {selectedRequest.status === 'completed' ? (
                        <Check size={10} />
                      ) : selectedRequest.status === 'in_progress' ? (
                        <RefreshCw size={10} className="animate-spin" />
                      ) : (
                        <Clock size={10} />
                      )}
                      {selectedRequest.status === 'in_progress'
                        ? 'In Progress'
                        : selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                  <User size={12} />
                  Specialist
                </div>
                <p className="text-sm font-medium text-slate-900">
                  {selectedRequest.specialistName || 'Not assigned yet'}
                </p>
                {selectedRequest.specialistName && (
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedRequest.seen ? 'Viewed ✓' : 'Not yet viewed'}
                  </p>
                )}
              </div>

              {selectedRequest.clientName && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Mail size={12} />
                    Submitted By
                  </div>
                  <p className="text-sm font-medium text-slate-900">{selectedRequest.clientName}</p>
                  {selectedRequest.clientEmail && (
                    <p className="text-xs text-slate-500">{selectedRequest.clientEmail}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function RequestsWrapper() {
  return (
    <ErrorBoundary>
      <Requests />
    </ErrorBoundary>
  );
}
