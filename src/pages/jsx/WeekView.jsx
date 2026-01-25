import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Badge, Alert } from 'react-bootstrap';
import { getAllDays, getDayWorkoutGroups, generateWorkoutProgram } from '../../db/dataService';
import '../css/WeekView.css';

function WeekView() {
  const [days, setDays] = useState([]);
  const [dayWorkouts, setDayWorkouts] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const allDays = getAllDays();
      setDays(allDays);
      
      // Load workout groups for each day
      const workouts = {};
      allDays.forEach(day => {
        workouts[day.id] = getDayWorkoutGroups(day.id);
      });
      setDayWorkouts(workouts);
    } catch (error) {
      showAlert('Error loading data: ' + error.message, 'danger');
    }
  };

  const showAlert = (message, variant = 'info') => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAutoProgramming = () => {
    const result = generateWorkoutProgram();
    showAlert(result.message, result.success ? 'success' : 'info');
  };

  return (
    <Container className="week-view-page py-4">
      <div className="hero-section text-center mb-4">
        <h1 className="display-4 mb-3">Weekly Workout Program</h1>
        <p className="lead text-muted mb-4">
          Plan your training week, build workouts, and track your progress
        </p>
        <div className="d-flex justify-content-center gap-3 flex-wrap">
          <Button 
            variant="primary" 
            size="lg"
            onClick={handleAutoProgramming}
          >
            Auto-Generate Program
          </Button>
          <Button 
            as={Link}
            to="/data"
            variant="outline-primary" 
            size="lg"
          >
            Import/Export Data
          </Button>
        </div>
      </div>

      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Row className="g-4">
        {days.map(day => {
          const workoutGroups = dayWorkouts[day.id] || [];
          const hasWorkout = workoutGroups.length > 0;
          
          return (
            <Col key={day.id} xs={12} sm={6} lg={4} xl={3}>
              <Card className="day-card h-100">
                <Card.Header className={`text-white ${hasWorkout ? 'bg-success' : 'bg-secondary'}`}>
                  <h5 className="mb-0">{day.day_name}</h5>
                </Card.Header>
                <Card.Body>
                  {hasWorkout ? (
                    <div className="workout-groups mb-3">
                      <h6 className="text-muted mb-2">Workout Groups:</h6>
                      <div className="d-flex flex-wrap gap-2">
                        {workoutGroups.map(wg => (
                          <Badge key={wg.id} bg="primary">
                            {wg.workout_group_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted mb-3">No workout assigned</p>
                  )}
                  
                  <Button 
                    as={Link}
                    to={`/day/${day.id}`}
                    variant={hasWorkout ? 'primary' : 'outline-primary'}
                    className="w-100"
                  >
                    {hasWorkout ? 'Edit Workout' : 'Build Workout'}
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      <div className="mt-5 text-center">
        <Card className="bg-light">
          <Card.Body>
            <h5>Quick Actions</h5>
            <div className="d-flex justify-content-center gap-3 flex-wrap mt-3">
              <Button as={Link} to="/setup" variant="outline-secondary">
                Manage Exercises
              </Button>
              <Button as={Link} to="/data" variant="outline-secondary">
                Export to CSV
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}

export default WeekView;
