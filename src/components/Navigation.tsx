import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="nav-bar d-flex align-items-center justify-content-between px-3 position-relative">
      <NavLink to="/" className="nav-logo">LiftLog</NavLink>
      <div className="nav-links d-flex gap-3 position-relative">
        <button
          className="burger-btn"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
        >
          &#9776;
        </button>
        {open && (
          <>
            <div className="burger-backdrop" onClick={() => setOpen(false)} />
            <div className="burger-dropdown">
              <NavLink to="/tutorial" onClick={() => setOpen(false)}>Tutorial</NavLink>
              <NavLink to="/about" onClick={() => setOpen(false)}>About</NavLink>
            </div>
          </>
        )}
      </div>
      <div className="nav-info">
        {__APP_VERSION__} &middot; {__BUILD_DATE__}
      </div>
    </nav>
  );
}
