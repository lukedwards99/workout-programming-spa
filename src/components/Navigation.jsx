import { NavLink } from 'react-router-dom';
import '../App.css';

export default function Navigation() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" className="nav-logo">LiftLog</NavLink>
      <div className="nav-links">
        <NavLink to="/" end>Programs</NavLink>
        <NavLink to="/exercises">Exercises</NavLink>
        <NavLink to="/data">Data</NavLink>
      </div>
    </nav>
  );
}
