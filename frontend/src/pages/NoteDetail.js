import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const STATUS_LABELS = {
  active: { label: 'Active', cls: 'text-green-400 bg-green-900/30 border-green-800/40' },
  expired: { label: 'Expired', cls: 'text-gray-400 bg-gray-800 border-gray-700' },
  revoked: { label: 'Revoked', cls: 'text-red-400 bg-red-900/20 border-red-800/30' },
  already_used: { label: 'Used', cls: 'text-amber-400 bg-amber-900/20 border-amber-800/30' }
};

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);
  const [copiedToken, setCopiedToken] = useState('');
  const [showNewShare, setShowNewShare] = useState(false);
  const [newShareForm, setNewShareForm] = useState({ expiresAt: '', shareType: 'time-based', accessType: 'public' });
  const [newShareResult, setNewShareResult] = useState(null);
  const [newShareLoading, setNewShareLoading] = useState(false);

  const defaultExpiry = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  };

  const fetchNote = useCallback(async () => {
    try {
      const res = await api.get(`/notes/${id}`);
      setNote(res.data.note);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Note not found' : 'Failed to load note');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  const handleRevoke = async (token) => {
    if (!window.confirm('Revoke this share link? This cannot be undone.')) return;
    setRevoking(token);
    try {
      await api.delete(`/notes/${id}/share/${token}`);
      await fetchNote();
    } catch (err) {
      alert('Failed to revoke link');
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = (text, token) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  const handleNewShare = async (e) => {
    e.preventDefault();
    setNewShareLoading(true);
    try {
      const res = await api.post(`/notes/${id}/share`, {
        ...newShareForm,
        expiresAt: new Date(newShareForm.expiresAt).toISOString()
      });
      setNewShareResult(res.data.shareLink);
      await fetchNote();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate link');
    } finally {
      setNewShareLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this note? All share links will stop working.')) return;
    try {
      await api.delete(`/notes/${id}`);
      navigate('/notes/new');
    } catch (err) {
      alert('Failed to delete note');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-gray-400 mb-4">{error}</p>
      <Link to="/notes/new" className="btn-primary">Go home</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{note.title}</h1>
          <p className="text-xs text-gray-500 mt-1">Created {new Date(note.createdAt).toLocaleString()}</p>
        </div>
        <button onClick={handleDelete} className="btn-danger shrink-0">Delete note</button>
      </div>

      <div className="card">
        <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-200">Share links</h2>
          <button
            onClick={() => { setShowNewShare(s => !s); setNewShareForm({ expiresAt: defaultExpiry(), shareType: 'time-based', accessType: 'public' }); setNewShareResult(null); }}
            className="btn-secondary text-sm py-1.5"
          >
            + New link
          </button>
        </div>

        {showNewShare && (
          <div className="card border-dashed space-y-4">
            {newShareResult ? (
              <div className="space-y-3">
                <p className="text-sm text-green-400 font-medium">✓ New link generated</p>
                <div className="flex gap-2">
                  <input readOnly className="input font-mono text-xs flex-1"
                    value={`${window.location.origin}/share/${newShareResult.token}`} />
                  <button className="btn-secondary text-sm" onClick={() => handleCopy(`${window.location.origin}/share/${newShareResult.token}`, 'new')}>
                    {copiedToken === 'new' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {newShareResult.generatedPassword && (
                  <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
                    <p className="text-xs text-amber-300 mb-2">⚠ Save this access key — shown only once</p>
                    <code className="font-mono text-base text-amber-100 tracking-widest block text-center bg-amber-900/20 rounded px-3 py-2">
                      {newShareResult.generatedPassword}
                    </code>
                  </div>
                )}
                <button onClick={() => { setShowNewShare(false); setNewShareResult(null); }} className="btn-secondary w-full text-sm">Close</button>
              </div>
            ) : (
              <form onSubmit={handleNewShare} className="space-y-3">
                <h3 className="text-sm font-medium text-gray-300">Generate new share link</h3>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expires at</label>
                  <input type="datetime-local" className="input text-sm"
                    value={newShareForm.expiresAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={e => setNewShareForm(f => ({ ...f, expiresAt: e.target.value }))}
                    required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Share type</label>
                    <select className="input text-sm" value={newShareForm.shareType}
                      onChange={e => setNewShareForm(f => ({ ...f, shareType: e.target.value }))}>
                      <option value="time-based">Time-based</option>
                      <option value="one-time">One-time</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Access</label>
                    <select className="input text-sm" value={newShareForm.accessType}
                      onChange={e => setNewShareForm(f => ({ ...f, accessType: e.target.value }))}>
                      <option value="public">Public</option>
                      <option value="password-protected">Password protected</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full text-sm" disabled={newShareLoading}>
                  {newShareLoading ? 'Generating...' : 'Generate'}
                </button>
              </form>
            )}
          </div>
        )}

        {note.shareLinks.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No share links yet</p>
        )}

        {note.shareLinks.map(link => {
          const shareUrl = `${window.location.origin}/share/${link.token}`;
          const statusInfo = STATUS_LABELS[link.status] || STATUS_LABELS.expired;
          return (
            <div key={link.token} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{link.shareType.replace('-', ' ')}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500 capitalize">{link.accessType.replace('-', ' ')}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">{link.viewCount} view{link.viewCount !== 1 ? 's' : ''}</span>
                </div>
                {link.status === 'active' && (
                  <button
                    onClick={() => handleRevoke(link.token)}
                    disabled={revoking === link.token}
                    className="btn-danger shrink-0"
                  >
                    {revoking === link.token ? 'Revoking...' : 'Revoke'}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input readOnly className="input font-mono text-xs flex-1" value={shareUrl} />
                <button className="btn-secondary text-sm" onClick={() => handleCopy(shareUrl, link.token)}>
                  {copiedToken === link.token ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="text-xs text-gray-600">
                Expires: {new Date(link.expiresAt).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
