import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import WorkoutEditor from './pages/WorkoutEditor';
import { Container } from 'react-bootstrap';

function App() {
  return (
    <Router>
      <Navigation />
      <Container className="mt-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workout/:id" element={<WorkoutEditor />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
