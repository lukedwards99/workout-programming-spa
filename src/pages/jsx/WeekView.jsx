import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Badge, Alert, Modal, Form, Dropdown } from 'react-bootstrap';
import {
  daysApi,
  dayWorkoutGroupsApi,
  programApi
} from '../../api/workoutApi';
import '../css/WeekView.css';

function WeekView() {
  const [days, setDays] = useState([]);
  const [dayWorkouts, setDayWorkouts] = useState({});
  const [alert, setAlert] = useState(null);
  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [newDayName, setNewDayName] = useState('');
  const [addAfterDayId, setAddAfterDayId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const daysResponse = await daysApi.getAll();
    
    if (daysResponse.success) {
      setDays(daysResponse.data);
      
      // Load workout groups for each day
      const workouts = {};
      for (const day of daysResponse.data) {
        const dayGroupsResponse = await dayWorkoutGroupsApi.getByDay(day.id);
        if (dayGroupsResponse.success) {
          workouts[day.id] = dayGroupsResponse.data;
        }
      }
      setDayWorkouts(workouts);
    } else {
      showAlert(daysResponse.error, 'danger');
    }
  };

  const showAlert = (message, variant = 'info') => {
    setAlert({ message, variant });
    // setTimeout(() => setAlert(null), 4000);
  };

  const handleAutoProgramming = async () => {
    const response = await programApi.generate();
    if (response.success) {
      showAlert(response.message, 'success');
    } else {
      showAlert(response.error, 'info');
    }
  };

  const handleOpenAddDay = () => {
    setNewDayName('');
    setAddAfterDayId(null);
    setShowAddDayModal(true);
  };

  const handleOpenAddDayAfter = (dayId) => {
    setNewDayName('');
    setAddAfterDayId(dayId);
    setShowAddDayModal(true);
  };

  const handleAddDay = async () => {
    if (!newDayName.trim()) {
      showAlert('Please enter a day name', 'warning');
      return;
    }

    // Check for uniqueness
    if (days.some(day => day.day_name.toLowerCase() === newDayName.trim().toLowerCase())) {
      showAlert('A day with this name already exists', 'warning');
      return;
    }

    let response;
    if (addAfterDayId) {
      response = await daysApi.insertAfter(newDayName.trim(), addAfterDayId);
    } else {
      response = await daysApi.add(newDayName.trim());
    }
    
    if (response.success) {
      showAlert(`Day "${newDayName}" added successfully`);
      setShowAddDayModal(false);
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleRemoveLastDay = async () => {
    if (days.length === 0) {
      showAlert('No days to remove', 'warning');
      return;
    }

    const lastDay = days[days.length - 1];
    
    if (!window.confirm(`Remove "${lastDay.day_name}"? This will delete all associated workout data for this day.`)) {
      return;
    }

    const response = await daysApi.removeLast();
    
    if (response.success) {
      showAlert('Day removed successfully');
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleDeleteDay = async (day) => {
    if (!window.confirm(`Delete "${day.day_name}"? This will delete all associated workout data for this day and reorder the remaining days.`)) {
      return;
    }

    const response = await daysApi.delete(day.id);
    
    if (response.success) {
      showAlert('Day deleted successfully');
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleDuplicateDay = async (day) => {
    const response = await daysApi.duplicate(day.id);
    
    if (response.success) {
      showAlert(`Day "${day.day_name}" duplicated successfully`);
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  return (
    <Container className="week-view-page py-4">
      <div className="hero-section text-center mb-4">
        <h1 className="display-4 mb-3">Build Your Program</h1>
        <p className="lead text-muted mb-4">
          Plan your training days, build workouts, and track your progress. Free, open source, forever.
        </p>
        <div className="d-flex justify-content-center gap-3 flex-wrap">
          {/* <Button 
            variant="primary" 
            size="lg"
            onClick={handleAutoProgramming}
          >
            Auto-Generate Program
          </Button> */}
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

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>{days.length} {days.length === 1 ? 'Day' : 'Days'} in Program</h3>
        <div className="d-flex gap-2">
          {days.length > 0 && (
            <Button variant="outline-danger" onClick={handleRemoveLastDay}>
              Remove Last Day
            </Button>
          )}
          <Button variant="success" onClick={handleOpenAddDay}>
            + Add Day
          </Button>
        </div>
      </div>

      <Row className="g-4">
        {days.map(day => {
          const workoutGroups = dayWorkouts[day.id] || [];
          const hasWorkout = workoutGroups.length > 0;
          
          return (
            <Col key={day.id} xs={12} sm={6} lg={4} xl={3}>
              <Card className="day-card h-100">
                <Card.Header className={`text-white ${hasWorkout ? 'bg-success' : 'bg-secondary'} d-flex justify-content-between align-items-center`}>
                  <h5 className="mb-0">{day.day_name}</h5>
                  <Dropdown align="end">
                    <Dropdown.Toggle 
                      variant="link" 
                      size="sm" 
                      className="text-white p-0 shadow-none"
                      style={{ fontSize: '1.2rem' }}
                    >
                      ⋮
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => handleOpenAddDayAfter(day.id)}>
                        ➕ Add Day After
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => handleDuplicateDay(day)}>
                        📋 Duplicate Day
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item 
                        onClick={() => handleDeleteDay(day)}
                        className="text-danger"
                      >
                        🗑️ Delete Day
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
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

      {days.length === 0 && (
        <div className="text-center py-5">
          <h4 className="text-muted mb-3">No days in your program yet</h4>
          <p className="text-muted mb-4">Click "+ Add Day" to start building your workout program</p>
          <Button variant="primary" size="lg" onClick={handleOpenAddDay}>
            + Add Your First Day
          </Button>
        </div>
      )}

      {/* Add Day Modal */}
      <Modal show={showAddDayModal} onHide={() => setShowAddDayModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {addAfterDayId 
              ? `Add Day After "${days.find(d => d.id === addAfterDayId)?.day_name}"` 
              : 'Add New Day'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Day Name</Form.Label>
              <Form.Control
                type="text"
                value={newDayName}
                onChange={(e) => setNewDayName(e.target.value)}
                placeholder="e.g., Monday, Day 1, Upper Body"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDay();
                  }
                }}
              />
              <Form.Text className="text-muted">
                Enter a unique name for this day
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddDayModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleAddDay}>
            Add Day
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default WeekView;
