import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Dashboard() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notes')
      .then(res => setNotes(res.data.notes))
      .catch(() => setError('Failed to load notes'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this note? All share links will stop working.')) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes(prev => prev.filter(n => n._id !== id));
    } catch {
      alert('Failed to delete note');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-gray-400">{error}</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">My Notes</h1>
      </div>

      {notes.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <p className="text-gray-400">No notes yet.</p>
          <Link to="/notes/new" className="btn-primary inline-block text-sm">Create your first note</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div
              key={note._id}
              onClick={() => navigate(`/notes/${note._id}`)}
              className="card cursor-pointer hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-white truncate">{note.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Updated {new Date(note.updatedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, note._id)}
                  className="btn-danger shrink-0"
                >
                  Delete
                </button>
              </div>

              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${accent ? 'text-indigo-400' : 'text-gray-200'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
