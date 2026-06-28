import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

const ERROR_MESSAGES = {
  invalid_token: { title: 'Link not found', body: 'This share link does not exist or has been deleted.', icon: '🔍' },
  revoked: { title: 'Link revoked', body: 'The owner has revoked this share link.', icon: '🚫' },
  expired: { title: 'Link expired', body: 'This share link has expired and is no longer accessible.', icon: '⏰' },
  already_used: { title: 'Link already used', body: 'This was a one-time link and has already been accessed.', icon: '✅' },
  server_error: { title: 'Something went wrong', body: 'Please try again later.', icon: '⚠️' }
};

export default function ShareView() {
  const { token } = useParams();
  const [stage, setStage] = useState('loading'); // loading | password | content | error
  const [meta, setMeta] = useState(null);
  const [note, setNote] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await api.get(`/share/${token}/meta`);
        setMeta(res.data);

        if (res.data.accessType === 'public') {
          // Auto-access public links
          await accessNote('');
        } else {
          setStage('password');
        }
      } catch (err) {
        const reason = err.response?.data?.error || 'server_error';
        setErrorInfo(ERROR_MESSAGES[reason] || ERROR_MESSAGES.server_error);
        setStage('error');
      }
    };
    fetchMeta();
    // eslint-disable-next-line
  }, [token]);

  const accessNote = async (pwd) => {
    setAccessLoading(true);
    try {
      const res = await api.post(`/share/${token}/access`, { password: pwd });
      setNote(res.data);
      setStage('content');
    } catch (err) {
      const reason = err.response?.data?.error || 'server_error';
      if (reason === 'wrong_password') {
        setPasswordError('Incorrect access key. Please try again.');
        setStage('password');
      } else if (reason === 'password_required') {
        setStage('password');
      } else {
        setErrorInfo(ERROR_MESSAGES[reason] || ERROR_MESSAGES.server_error);
        setStage('error');
      }
    } finally {
      setAccessLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!password.trim()) {
      setPasswordError('Please enter the access key');
      return;
    }
    accessNote(password.trim());
  };

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (stage === 'error') {
    const info = errorInfo || ERROR_MESSAGES.server_error;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">{info.icon}</div>
          <h1 className="text-xl font-semibold text-white">{info.title}</h1>
          <p className="text-gray-400 text-sm">{info.body}</p>
          <p className="text-xs text-gray-600">Token: <code className="font-mono">{token.slice(0, 8)}...</code></p>
        </div>
      </div>
    );
  }

  if (stage === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-xl font-semibold text-white">Protected note</h1>
            <p className="text-gray-400 text-sm mt-1">Enter the access key to view this note</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="card space-y-4">
            {passwordError && (
              <div className="bg-red-900/30 border border-red-800/50 text-red-300 rounded-lg px-4 py-3 text-sm">
                {passwordError}
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Access key</label>
              <input
                type="text"
                className="input font-mono tracking-widest text-center text-lg uppercase"
                placeholder="XXXX-XXXX-XXXX"
                value={password}
                onChange={e => setPassword(e.target.value.toUpperCase())}
                autoFocus
                autoComplete="off"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={accessLoading}>
              {accessLoading ? 'Verifying...' : 'Unlock note'}
            </button>
          </form>

          {meta?.shareType === 'one-time' && (
            <p className="text-center text-xs text-amber-500/70 mt-4">
              ⚠ This is a one-time link. It will expire after you view the note.
            </p>
          )}
        </div>
      </div>
    );
  }

  // stage === 'content'
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-0.5 font-mono">
            Shared note
          </span>
          {note?.shareType === 'one-time' && (
            <span className="text-xs text-amber-500 bg-amber-900/20 border border-amber-800/30 rounded-full px-2.5 py-0.5">
              One-time access — this link is now spent
            </span>
          )}
          {note?.expiresAt && (
            <span className="text-xs text-gray-500">
              Expires {new Date(note.expiresAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="card space-y-4">
          <h1 className="text-2xl font-bold text-white">{note?.title}</h1>
          <hr className="border-gray-800" />
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{note?.content}</p>
        </div>

        <p className="text-center text-xs text-gray-700 mt-8">
          Shared via NoteShare
        </p>
      </div>
    </div>
  );
}
