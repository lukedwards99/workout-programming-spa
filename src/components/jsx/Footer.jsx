import React from 'react';
import { Container } from 'react-bootstrap';
import '../css/Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer bg-dark text-white mt-auto py-3">
      <Container>
        <div className="text-center">
          <p className="mb-0">
            Workout Programming App &copy; {currentYear}
          </p>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
