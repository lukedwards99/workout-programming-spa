import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import '../css/Navigation.css';

function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <Navbar expand="md" bg="dark" variant="dark" fixed="top" expanded={isMenuOpen}>
      <Container>
        <Navbar.Brand as={Link} to="/" onClick={closeMenu}>
          <strong>Complete Workout Programming</strong>
          <small className="d-block" style={{ fontSize: '0.7rem', color: '#ccc' }}>
            Version: Alpha 1.0.0 <br />
            Built: {__BUILD_DATE__}
          </small>
        </Navbar.Brand>

        <Navbar.Toggle 
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        />

        <Navbar.Collapse>
          <Nav className="ms-auto">
            <Nav.Link 
              as={Link}
              to="/" 
              className={isActive('/') ? 'active' : ''}
              onClick={closeMenu}
            >
              Week View
            </Nav.Link>
            <Nav.Link 
              as={Link}
              to="/setup" 
              className={isActive('/setup') ? 'active' : ''}
              onClick={closeMenu}
            >
              Exercise Setup
            </Nav.Link>
            <Nav.Link 
              as={Link}
              to="/data" 
              className={isActive('/data') ? 'active' : ''}
              onClick={closeMenu}
            >
              Data Management
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;
