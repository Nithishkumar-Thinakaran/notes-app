import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-lg font-semibold text-white tracking-tight">
            NoteShare
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isActive('/dashboard')
                  ? 'text-white bg-gray-800'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/notes/new"
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isActive('/notes/new')
                  ? 'text-white bg-gray-800'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              New Note
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{user?.username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
