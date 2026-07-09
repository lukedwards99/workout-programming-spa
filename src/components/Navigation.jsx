import { NavLink } from 'react-router-dom';

export default function Navigation() {
  return (
    <nav className="nav-bar d-flex align-items-center justify-content-between px-3">
      <NavLink to="/" className="nav-logo">LiftLog</NavLink>
      <div className="nav-links d-flex gap-3">
        <NavLink to="/" end>Programs</NavLink>
      </div>
    </nav>
  );
}
