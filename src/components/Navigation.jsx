import React, { useRef } from 'react';
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useDb } from '../db/DbContext';

const Navigation = () => {
  const { exportToCsv, importFromCsv } = useDb();
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      importFromCsv(file);
    }
  };

  const handleAutoStub = () => {
    alert("Auto-Programming Feature: Coming Soon!");
    console.log("Auto-programming stub triggered.");
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">TrainSmart</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">Weekly Program</Nav.Link>
            <Nav.Link onClick={handleAutoStub}>Auto-Program</Nav.Link>
          </Nav>
          <Nav>
            <Button variant="outline-light" className="me-2" onClick={exportToCsv}>
              Export CSV
            </Button>
            <Button variant="outline-success" onClick={() => fileInputRef.current.click()}>
              Import CSV
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv" 
              onChange={handleFileUpload}
            />
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
