import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  LifeBuoy, 
  Copy, 
  Check,
  Bookmark 
} from 'lucide-react';
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
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
    const trackingUrl = `${window.location.origin}/track/${submissionResult.ticketNumber}`;

    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-slate-800/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden backdrop-blur">
          {/* Success Check Icon */}
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
            Support Request Submitted!
          </h2>
          <p className="text-slate-300 text-sm max-w-lg mx-auto mb-6">
            Your ticket is registered in our queue. Keep your <strong className="text-white">Ticket ID</strong> below to track status, monitor updates, and view support replies.
          </p>

          {/* Prominent Ticket ID Hero Banner */}
          <div className="bg-slate-900/90 border-2 border-brand-500/40 rounded-2xl p-6 mb-6 shadow-xl text-left relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                Your Ticket ID
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Active & Queued
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
              <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-wider">
                {submissionResult.ticketNumber}
              </span>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(submissionResult.ticketNumber);
                  setCopiedRef(true);
                  setTimeout(() => setCopiedRef(false), 2500);
                }}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-md ${
                  copiedRef
                    ? 'bg-emerald-600 text-white'
                    : 'bg-brand-600 hover:bg-brand-500 text-white'
                }`}
              >
                {copiedRef ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Ticket ID</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
              <p className="truncate">
                Subject: <span className="text-slate-200 font-medium">{submissionResult.subject}</span>
              </p>
              <p className="text-slate-500 text-[11px] mt-1">
                Save this ID (<strong>{submissionResult.ticketNumber}</strong>). You can enter it on our Help Center at any time to monitor ticket updates.
              </p>
            </div>
          </div>

          {/* Quick Monitoring Guide */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-8 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-brand-400" />
              <span>How to monitor your ticket:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <div className="font-semibold text-white mb-1">1. Save Ticket ID</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Record <strong>{submissionResult.ticketNumber}</strong> or bookmark your direct link.
                </p>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <div className="font-semibold text-white mb-1">2. Track Status</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Enter your Ticket ID in the Help Center search bar anytime.
                </p>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <div className="font-semibold text-white mb-1">3. Live Conversation</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Auto-refreshes when support agents reply. Post follow-ups directly.
                </p>
              </div>
            </div>
          </div>

          {/* Action Navigation */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/track/${submissionResult.ticketNumber}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition shadow-lg shadow-brand-600/30"
            >
              <span>Track Ticket ({submissionResult.ticketNumber})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(trackingUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2500);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-sm font-medium transition border border-slate-600/50"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Tracking Link</span>
                </>
              )}
            </button>

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
              className="px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-sm font-medium transition"
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
