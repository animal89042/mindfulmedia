import React, { useState, useEffect, useRef } from 'react';
import './Settings.css';

const Settings = ({ theme, toggleTheme }) => {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(
    () => localStorage.getItem('compactCapsules') === 'true'
  );
  const [listMode, setListMode] = useState(
    () => localStorage.getItem('listMode') === 'true'
  );
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('compact-capsules', compact);
    localStorage.setItem('compactCapsules', compact);
  }, [compact]);

  useEffect(() => {
    document.body.classList.toggle('list-modules', listMode);
    localStorage.setItem('listMode', listMode);
  }, [listMode]);

  const handleToggleTheme = () => {
    toggleTheme();
    setOpen(false);
  };

  const handleToggleCompact = () => {
    setCompact(c => !c);
    setOpen(false);
  };

  const handleToggleList = () => {
    setListMode(l => !l);
    setOpen(false);
  };

  return (
    <div className="settings-dropdown" ref={ref}>
      <button className="nav-button dropdown-button" onClick={() => setOpen(o => !o)}>
        Settings ⚙️
      </button>
      {open && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={handleToggleTheme}>
            {theme === 'dark' ? 'Light Mode ☀️' : 'Dark Mode 🌙'}
          </button>
          <button className="dropdown-item" onClick={handleToggleCompact}>
            {compact ? 'Normal Capsules' : 'Compact Capsules'}
          </button>
          <button className="dropdown-item" onClick={handleToggleList}>
            {listMode ? 'Grid View' : 'List Modules'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Settings;