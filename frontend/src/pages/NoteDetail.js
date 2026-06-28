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

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

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

  const handleEditStart = () => {
    setEditForm({ title: note.title, content: note.content });
    setEditError('');
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.content.trim()) {
      setEditError('Title and content are required');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      await api.put(`/notes/${id}`, { title: editForm.title, content: editForm.content });
      await fetchNote();
      setIsEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

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
      navigate('/dashboard');
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
      <Link to="/dashboard" className="btn-primary">Back to dashboard</Link>
    </div>
  );

  // Compute totalViews from shareLinks since GET /api/notes/:id doesn't return it directly
  const totalViews = note.totalViews ?? note.shareLinks.reduce((sum, l) => sum + (l.viewCount || 0), 0);
  const activeShares = note.shareLinks.filter(l => l.status === 'active').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2 inline-block">
            ← Dashboard
          </Link>
          {!isEditing && (
            <h1 className="text-2xl font-bold text-white">{note.title}</h1>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Created {new Date(note.createdAt).toLocaleString()}
          </p>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleEditStart} className="btn-secondary text-sm py-1.5">
              Edit
            </button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        )}
      </div>

      {/* Stats row */}
<div className="grid grid-cols-2 gap-3">
  {[
    { label: 'Total Views', value: totalViews },
    { label: 'Active Links', value: activeShares, accent: true },
  ].map(s => (
    <div 
      key={s.label} 
      className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-center"
    >
      <div className={`text-xl font-bold ${s.accent ? 'text-indigo-400' : 'text-gray-100'}`}>
        {s.value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        {s.label}
      </div>
    </div>
  ))}
</div>

      {/* Note content / Edit form */}
      {isEditing ? (
        <form onSubmit={handleEditSave} className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Edit note</h2>

          {editError && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-300 rounded-lg px-4 py-3 text-sm">
              {editError}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Title</label>
            <input
              type="text"
              className="input"
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Content</label>
            <textarea
              className="input min-h-40 resize-y"
              value={editForm.content}
              onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
              maxLength={50000}
              required
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1" disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" onClick={handleEditCancel} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
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
  
  );
}
