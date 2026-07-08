import { NavLink } from 'react-router-dom';

export default function Navigation() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" className="nav-logo">LiftLog</NavLink>
      <div className="nav-links">
        <NavLink to="/" end>Programs</NavLink>
      </div>
    </nav>
  );
}
