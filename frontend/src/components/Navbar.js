import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/notes/new" className="text-lg font-semibold text-white tracking-tight">
          NoteShare
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">{user?.username}</span>
          <Link to="/notes/new" className="btn-primary text-sm py-1.5">
            + New Note
          </Link>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
