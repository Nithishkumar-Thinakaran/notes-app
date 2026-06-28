import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const defaultExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 16);
};

export default function NewNote() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    content: '',
    expiresAt: defaultExpiry(),
    shareType: 'time-based',
    accessType: 'public'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/notes', {
        ...form,
        expiresAt: new Date(form.expiresAt).toISOString()
      });
      setCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = created
    ? `${window.location.origin}/share/${created.shareLink.token}`
    : '';

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (created) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-900/50 flex items-center justify-center text-green-400 text-xl">✓</div>
            <div>
              <h2 className="text-lg font-semibold text-white">Note created</h2>
              <p className="text-sm text-gray-400">Your share link is ready</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Share link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="input font-mono text-sm flex-1"
              />
              <button onClick={() => handleCopy(shareUrl)} className="btn-secondary whitespace-nowrap text-sm">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {created.shareLink.generatedPassword && (
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4 space-y-2">
              <p className="text-sm text-amber-300 font-medium">⚠ Save this access key — it won't be shown again</p>
              <div className="flex gap-2 items-center">
                <code className="font-mono text-lg text-amber-100 tracking-widest flex-1 bg-amber-900/20 rounded px-3 py-2 text-center">
                  {created.shareLink.generatedPassword}
                </code>
                <button onClick={() => handleCopy(created.shareLink.generatedPassword)} className="btn-secondary text-sm">
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-800/60 rounded-lg px-3 py-2">
              <span className="text-gray-500 block text-xs mb-0.5">Share type</span>
              <span className="text-gray-200 capitalize">{created.shareLink.shareType.replace('-', ' ')}</span>
            </div>
            <div className="bg-gray-800/60 rounded-lg px-3 py-2">
              <span className="text-gray-500 block text-xs mb-0.5">Access</span>
              <span className="text-gray-200 capitalize">{created.shareLink.accessType.replace('-', ' ')}</span>
            </div>
            <div className="bg-gray-800/60 rounded-lg px-3 py-2 col-span-2">
              <span className="text-gray-500 block text-xs mb-0.5">Expires</span>
              <span className="text-gray-200">{new Date(created.shareLink.expiresAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate(`/notes/${created.note._id}`)}
              className="btn-secondary flex-1"
            >
              View note
            </button>
            <button
              onClick={() => { setCreated(null); setForm({ title: '', content: '', expiresAt: defaultExpiry(), shareType: 'time-based', accessType: 'public' }); }}
              className="btn-primary flex-1"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-white mb-6">New Note</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-900/30 border border-red-800/50 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div className="card space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Title</label>
            <input
              type="text"
              className="input"
              placeholder="Note title"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Content</label>
            <textarea
              className="input min-h-40 resize-y"
              placeholder="Write your note here..."
              value={form.content}
              onChange={e => set('content', e.target.value)}
              required maxLength={50000}
            />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="text-sm font-medium text-gray-300">Share settings</h3>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Expires at</label>
            <input
              type="datetime-local"
              className="input"
              value={form.expiresAt}
              min={new Date().toISOString().slice(0, 16)}
              onChange={e => set('expiresAt', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Share type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'time-based', label: 'Time-based', desc: 'Anyone can access until expiry' },
                { value: 'one-time', label: 'One-time', desc: 'Link expires after first view' }
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    form.shareType === opt.value
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="shareType"
                    value={opt.value}
                    checked={form.shareType === opt.value}
                    onChange={() => set('shareType', opt.value)}
                    className="sr-only"
                  />
                  <div className="text-sm font-medium text-gray-200">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Access type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'public', label: 'Public', desc: 'No password needed' },
                { value: 'password-protected', label: 'Password protected', desc: 'Auto-generates an access key' }
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    form.accessType === opt.value
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="accessType"
                    value={opt.value}
                    checked={form.accessType === opt.value}
                    onChange={() => set('accessType', opt.value)}
                    className="sr-only"
                  />
                  <div className="text-sm font-medium text-gray-200">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
          {loading ? 'Creating...' : 'Create note & generate link'}
        </button>
      </form>
    </div>
  );
}
