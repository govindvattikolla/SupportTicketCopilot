import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, LifeBuoy } from 'lucide-react';
import { submitPublicTicketApi, SubmitTicketResult, TicketCategory, TicketPriority } from '../api/client';

export const SupportPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'general' as TicketCategory,
    priority: 'P3' as TicketPriority,
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmitTicketResult | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await submitPublicTicketApi(formData);
      setSubmissionResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit ticket. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submissionResult) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Support Request Received</h2>
          <p className="text-slate-300 text-sm mb-6">
            Your ticket has been logged into our queue. Keep your reference code and secure tracking link below.
          </p>

          <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5 mb-6 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-semibold">Ticket Reference</span>
              <span className="text-sm font-mono font-bold text-brand-400">
                {submissionResult.ticketNumber}
              </span>
            </div>
            <div className="pt-3">
              <span className="text-xs text-slate-400 uppercase font-semibold">Subject</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5 truncate">
                {submissionResult.subject}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/track/${submissionResult.trackingToken}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-lg shadow-brand-600/30"
            >
              <span>Track Ticket & View Thread</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => {
                setSubmissionResult(null);
                setFormData({
                  name: '',
                  email: '',
                  subject: '',
                  category: 'general',
                  priority: 'P3',
                  description: '',
                });
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-semibold mb-3 border border-brand-500/20">
          <LifeBuoy className="w-3.5 h-3.5" />
          Customer Help Desk
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Submit a Support Request
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          No internal account required. Fill in the details below to receive a secure tracking reference.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Full Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Jane Doe"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. jane@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              >
                <option value="general">General Inquiry</option>
                <option value="technical">Technical Issue</option>
                <option value="billing">Billing & Subscription</option>
                <option value="bug">Bug Report</option>
                <option value="feature_request">Feature Request</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Urgency Level
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              >
                <option value="P3">P3 - Normal (Standard questions)</option>
                <option value="P4">P4 - Low (Minor feedback / suggestions)</option>
                <option value="P2">P2 - High (Important feature affected)</option>
                <option value="P1">P1 - Critical (Complete production outage)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Subject *
            </label>
            <input
              type="text"
              name="subject"
              required
              minLength={3}
              value={formData.subject}
              onChange={handleChange}
              placeholder="Summary of the issue..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description *
            </label>
            <textarea
              name="description"
              required
              rows={5}
              minLength={10}
              value={formData.description}
              onChange={handleChange}
              placeholder="Please provide details, steps to reproduce, or any relevant context..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-y"
            ></textarea>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>A secure tracking reference will be generated for your request</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-lg shadow-brand-600/30 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
