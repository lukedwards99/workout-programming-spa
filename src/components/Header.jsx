import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';

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
          <span className="ms-2" style={{ fontSize: '0.8rem', color: '#bbb', fontStyle: 'italic' }}>
            Beta
          </span>
        </Navbar.Brand>

        <Navbar.Toggle 
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        />

        <Navbar.Collapse>
          <Nav className="ms-auto">
            {/* <Nav.Link 
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
              to="/summary" 
              className={isActive('/summary') ? 'active' : ''}
              onClick={closeMenu}
            >
              Summary
            </Nav.Link> */}
            <Nav.Link 
              as={Link}
              to="/data" 
              className={isActive('/data') ? 'active' : ''}
              onClick={closeMenu}
            >
              Data Import/Export
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;
