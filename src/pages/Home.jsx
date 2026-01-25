import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Badge, Spinner } from 'react-bootstrap';
import { useDb } from '../db/DbContext';

const Home = () => {
  const { db, isLoading, getWorkouts, getWorkoutSummary } = useDb();
  const [workouts, setWorkouts] = useState([]);
  const [summaries, setSummaries] = useState({});

  useEffect(() => {
    if (db && !isLoading) {
      refreshData();
    }
  }, [db, isLoading]);

  const refreshData = () => {
    const allWorkouts = getWorkouts();
    setWorkouts(allWorkouts);

    const summs = {};
    allWorkouts.forEach(w => {
      summs[w.id] = getWorkoutSummary(w.id);
    });
    setSummaries(summs);
  };

  if (isLoading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading Database...</span>
        </Spinner>
        <p>Initializing SQLite Engine...</p>
      </Container>
    );
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Weekly Schedule</h2>
        
      </div>
      <Row xs={1} md={2} lg={3} className="g-4">
        {workouts.map((workout) => (
          <Col key={workout.id}>
            <Card className="h-100 shadow-sm">
              <Card.Header className={workout.is_rest_day ? "bg-secondary text-white" : "bg-primary text-white"}>
                <h5 className="mb-0">{workout.day_name}</h5>
              </Card.Header>
              <Card.Body>
                <Card.Title>{workout.workout_name || (workout.is_rest_day ? "Rest Day" : "Untitled Workout")}</Card.Title>
                
                <div className="mt-3">
                  {workout.is_rest_day ? (
                     <Badge bg="success">REST</Badge>
                  ) : (
                    <>
                      <h6>Focus Groups:</h6>
                      {summaries[workout.id]?.length > 0 ? (
                        summaries[workout.id].map((grp, idx) => (
                          <Badge bg="info" className="me-1 mb-1" key={idx}>{grp}</Badge>
                        ))
                      ) : (
                        <span className="text-muted small">No exercises planned.</span>
                      )}
                    </>
                  )}
                </div>
              </Card.Body>
              <Card.Footer className="text-muted small text-center cursor-pointer">
                 <a href={`/workout/${workout.id}`} className="text-decoration-none stretched-link">Edit Workout</a>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Home;
