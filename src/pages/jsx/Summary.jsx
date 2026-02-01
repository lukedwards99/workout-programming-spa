import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Form, Alert, Badge, Collapse } from 'react-bootstrap';
import { summaryApi } from '../../api';
import '../css/Summary.css';

function Summary() {
  const [daysData, setDaysData] = useState([]);
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [aggregateStats, setAggregateStats] = useState(null);
  const [exerciseBreakdown, setExerciseBreakdown] = useState([]);
  const [alert, setAlert] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Recalculate aggregate stats whenever selection changes
    if (daysData.length > 0) {
      const stats = summaryApi.calculateAggregateStats(
        daysData, 
        Array.from(selectedDays)
      );
      setAggregateStats(stats);
      
      const breakdown = summaryApi.calculateExerciseBreakdown(
        daysData,
        Array.from(selectedDays)
      );
      setExerciseBreakdown(breakdown);
    }
  }, [selectedDays, daysData]);

  const loadData = async () => {
    const response = await summaryApi.getSummaryData();
    
    if (response.success) {
      setDaysData(response.data);
      // Select all days by default
      const allDayIds = new Set(response.data.map(day => day.id));
      setSelectedDays(allDayIds);
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const showAlert = (message, variant = 'info') => {
    setAlert({ message, variant });
  };

  const handleDayToggle = (dayId) => {
    const newSelection = new Set(selectedDays);
    if (newSelection.has(dayId)) {
      newSelection.delete(dayId);
    } else {
      newSelection.add(dayId);
    }
    setSelectedDays(newSelection);
  };

  const handleSelectAll = () => {
    const allDayIds = new Set(daysData.map(day => day.id));
    setSelectedDays(allDayIds);
  };

  const handleDeselectAll = () => {
    setSelectedDays(new Set());
  };

  const toggleDayExpansion = (dayId) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayId)) {
      newExpanded.delete(dayId);
    } else {
      newExpanded.add(dayId);
    }
    setExpandedDays(newExpanded);
  };

  const toggleGroupExpansion = (groupName) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  if (daysData.length === 0) {
    return (
      <Container className="summary-page mt-4">
        <Alert variant="info">
          No workout days found. Create days and add exercises to see summary statistics.
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="summary-page mt-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h1>Workout Summary</h1>
          <p className="text-muted">
            Overview of your workout program with detailed exercise statistics
          </p>
        </Col>
      </Row>

      {alert && (
        <Alert 
          variant={alert.variant} 
          dismissible 
          onClose={() => setAlert(null)}
        >
          {alert.message}
        </Alert>
      )}

      {/* Overall Summary Statistics */}
      {aggregateStats && (
        <Card className="mb-4 summary-stats-card">
          <Card.Body>
            <h5 className="mb-3">Overall Summary</h5>
            <Row>
              <Col xs={6} md={3} className="text-center mb-3">
                <div className="stat-value">{aggregateStats.totalDays}</div>
                <div className="stat-label">Days Included</div>
              </Col>
              <Col xs={6} md={3} className="text-center mb-3">
                <div className="stat-value">{aggregateStats.totalExercises}</div>
                <div className="stat-label">Unique Exercises</div>
              </Col>
              <Col xs={6} md={3} className="text-center mb-3">
                <div className="stat-value">{aggregateStats.totalSets}</div>
                <div className="stat-label">Total Sets</div>
              </Col>
              <Col xs={6} md={3} className="text-center mb-3">
                <div className="stat-value">
                  {aggregateStats.avgRir !== null ? aggregateStats.avgRir : 'N/A'}
                </div>
                <div className="stat-label">Average RIR</div>
              </Col>
            </Row>

            {/* Exercise Aggregates */}
            {aggregateStats.exerciseAggregates.length > 0 && (
              <div className="mt-4">
                <h6 className="mb-3">Exercise Breakdown Across Selected Days</h6>
                <div className="exercise-aggregates">
                  <Table responsive hover size="sm">
                    <thead>
                      <tr>
                        <th>Exercise</th>
                        <th>Workout Group</th>
                        <th className="text-center">Total Sets</th>
                        <th className="text-center">Avg RIR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregateStats.exerciseAggregates.map(exercise => (
                        <tr key={exercise.exerciseId}>
                          <td><strong>{exercise.exerciseName}</strong></td>
                          <td>
                            <Badge bg="secondary">{exercise.workoutGroupName}</Badge>
                          </td>
                          <td className="text-center">{exercise.totalSets}</td>
                          <td className="text-center">
                            {exercise.avgRir !== null ? exercise.avgRir : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Selection Controls */}
      <Card className="mb-3">
        <Card.Body className="py-2">
          <div className="d-flex align-items-center justify-content-between flex-wrap">
            <span className="text-muted">
              {selectedDays.size} of {daysData.length} days selected
            </span>
            <div>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); handleSelectAll(); }}
                className="me-3"
              >
                Select All
              </a>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); handleDeselectAll(); }}
              >
                Deselect All
              </a>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Exercise Breakdown by Workout Group */}
      {exerciseBreakdown.length > 0 && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Exercise Breakdown by Type</h5>
            <small className="text-muted">See which days each exercise appears on</small>
          </Card.Header>
          <Card.Body>
            {exerciseBreakdown.map((group, groupIndex) => {
              const isGroupExpanded = expandedGroups.has(group.workoutGroupName);
              
              return (
                <div key={group.workoutGroupName} className={groupIndex > 0 ? 'mt-4' : ''}>
                  <div 
                    className="workout-group-header d-flex justify-content-between align-items-center mb-2"
                    onClick={() => toggleGroupExpansion(group.workoutGroupName)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        toggleGroupExpansion(group.workoutGroupName);
                      }
                    }}
                  >
                    <h6 className="mb-0">
                      <Badge bg="primary" className="me-2">{group.workoutGroupName}</Badge>
                      <span className="text-muted small">
                        ({group.exercises.length} exercise{group.exercises.length !== 1 ? 's' : ''})
                      </span>
                    </h6>
                    <span className="text-primary fw-bold">
                      {isGroupExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                  
                  <Collapse in={isGroupExpanded}>
                    <div>
                      <Table responsive hover size="sm" className="exercise-type-table">
                        <thead>
                          <tr>
                            <th>Exercise</th>
                            <th className="text-center">Total Sets</th>
                            <th className="text-center">Avg RIR</th>
                            <th>Days Performed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.exercises.map(exercise => (
                            <tr key={exercise.exerciseId}>
                              <td><strong>{exercise.exerciseName}</strong></td>
                              <td className="text-center">{exercise.totalSets}</td>
                              <td className="text-center">
                                {exercise.avgRir !== null ? exercise.avgRir : 'N/A'}
                              </td>
                              <td>
                                <div className="day-appearances">
                                  {exercise.dayAppearances.map((day, idx) => (
                                    <span key={day.dayId} className="day-appearance-badge">
                                      <Badge bg="light" text="dark" className="me-1 mb-1">
                                        {day.dayName}: {day.setCount} set{day.setCount !== 1 ? 's' : ''}
                                        {day.avgRir !== null && ` (RIR ${day.avgRir})`}
                                      </Badge>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </Card.Body>
        </Card>
      )}

      {/*       href="#" 
                onClick={(e) => { e.preventDefault(); handleDeselectAll(); }}
              >
                Deselect All
              </a>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Days Summary Table */}
      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 summary-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }} className="text-center">Include</th>
                  <th>Day</th>
                  <th className="text-center d-none d-md-table-cell">Exercises</th>
                  <th className="text-center d-none d-md-table-cell">Sets</th>
                  <th className="text-center d-none d-md-table-cell">Avg RIR</th>
                  <th className="text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                {daysData.map(day => {
                  const isSelected = selectedDays.has(day.id);
                  const isExpanded = expandedDays.has(day.id);
                  
                  return (
                    <React.Fragment key={day.id}>
                      <tr className={isSelected ? 'selected-row' : ''}>
                        <td className="text-center align-middle">
                          <Form.Check
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleDayToggle(day.id)}
                            aria-label={`Include ${day.name} in summary`}
                          />
                        </td>
                        <td className="align-middle">
                          <strong>{day.name}</strong>
                        </td>
                        <td className="text-center align-middle d-none d-md-table-cell">
                          {day.totalExercises}
                        </td>
                        <td className="text-center align-middle d-none d-md-table-cell">
                          {day.totalSets}
                        </td>
                        <td className="text-center align-middle d-none d-md-table-cell">
                          {day.avgRir !== null ? day.avgRir : 'N/A'}
                        </td>
                        <td className="text-center align-middle">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleDayExpansion(day.id);
                            }}
                            aria-expanded={isExpanded}
                            className="btn btn-sm btn-outline-primary"
                          >
                            {isExpanded ? 'Hide' : 'Show'} Exercises
                          </a>
                        </td>
                      </tr>
                      
                      {/* Expandable row with exercise breakdown */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="p-0">
                            <Collapse in={isExpanded}>
                              <div className="exercise-breakdown-container">
                                {day.exerciseBreakdown.length > 0 ? (
                                  <Table size="sm" className="mb-0 exercise-breakdown-table">
                                    <thead>
                                      <tr>
                                        <th>Exercise</th>
                                        <th>Workout Group</th>
                                        <th className="text-center">Sets</th>
                                        <th className="text-center">Avg RIR</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day.exerciseBreakdown.map(exercise => (
                                        <tr key={exercise.exerciseId}>
                                          <td>{exercise.exerciseName}</td>
                                          <td>
                                            <Badge bg="secondary" className="small-badge">
                                              {exercise.workoutGroupName}
                                            </Badge>
                                          </td>
                                          <td className="text-center">{exercise.setCount}</td>
                                          <td className="text-center">
                                            {exercise.avgRir !== null ? exercise.avgRir : 'N/A'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                ) : (
                                  <div className="text-center text-muted py-3">
                                    No exercises programmed for this day
                                  </div>
                                )}
                              </div>
                            </Collapse>
                          </td>
                        </tr>
                      )}
                      
                      {/* Mobile-only stats row */}
                      <tr className="d-md-none mobile-stats-row">
                        <td colSpan="6">
                          <div className="d-flex justify-content-around text-center small text-muted">
                            <div>
                              <div><strong>{day.totalExercises}</strong></div>
                              <div>Exercises</div>
                            </div>
                            <div>
                              <div><strong>{day.totalSets}</strong></div>
                              <div>Sets</div>
                            </div>
                            <div>
                              <div><strong>{day.avgRir !== null ? day.avgRir : 'N/A'}</strong></div>
                              <div>Avg RIR</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default Summary;
