import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Row, Col, Table, Badge, InputGroup } from 'react-bootstrap';
import { useDb } from '../db/DbContext';

const WorkoutEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, isLoading } = useDb();
  
  const [workout, setWorkout] = useState(null);
  const [sets, setSets] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableExercises, setAvailableExercises] = useState([]);
  
  // New Set Form State
  const [newSetGroup, setNewSetGroup] = useState('');
  const [newSetExercise, setNewSetExercise] = useState('');
  
  useEffect(() => {
    if (db && !isLoading && id) {
      loadData();
    }
  }, [db, isLoading, id]);

  const loadData = () => {
    // Load Workout Info
    const wStmt = db.prepare("SELECT * FROM workouts WHERE id = ?");
    const wRes = wStmt.get([id]);
    if (wRes) {
      const wObj = {
        id: wRes[0],
        day_name: wRes[1],
        workout_name: wRes[2],
        is_rest_day: wRes[3]
      };
      setWorkout(wObj);
    }
    wStmt.free();

    // Load Sets
    // We join to get names for display
    const q = `
      SELECT s.id, s.set_order, s.reps, s.rir, s.notes,
             g.name as group_name, g.id as group_id,
             e.name as exercise_name, e.id as exercise_id
      FROM sets s
      JOIN workout_groups g ON s.group_id = g.id
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.workout_id = ?
      ORDER BY s.set_order
    `;
    const stmt = db.prepare(q);
    stmt.bind([id]);
    const loadedSets = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      loadedSets.push(row);
    }
    stmt.free();
    setSets(loadedSets);

    // Load Metadata for dropdowns
    loadDropdowns();
  };

  const loadDropdowns = () => {
    // Groups
    const gRes = db.exec("SELECT id, name FROM workout_groups ORDER BY name");
    if (gRes.length > 0) {
        setAvailableGroups(gRes[0].values.map(v => ({ id: v[0], name: v[1] })));
    }
    
    // Exercises
    const eRes = db.exec("SELECT id, name FROM exercises ORDER BY name");
    if (eRes.length > 0) {
        setAvailableExercises(eRes[0].values.map(v => ({ id: v[0], name: v[1] })));
    }
  };

  const updateWorkout = (field, value) => {
    db.run(`UPDATE workouts SET ${field} = ? WHERE id = ?`, [value, id]);
    setWorkout(prev => ({ ...prev, [field === 'workout_name' ? 'workout_name' : 'is_rest_day']: value }));
  };

  const handleAddSet = () => {
    // Simple add: if group/exercise exists, use ID, else create them? 
    // Requirement says "Exercises need to have exercise name".
    // For simplicity, let's assume they pick from existing or type new.
    // If they type new, we insert into dimension tables.
    
    if (!newSetGroup || !newSetExercise) return;

    db.run("BEGIN TRANSACTION");
    try {
        // Resolve Group
        let groupId;
        const gRow = availableGroups.find(g => g.name.toLowerCase() === newSetGroup.toLowerCase());
        if (gRow) {
            groupId = gRow.id;
        } else {
            db.run("INSERT INTO workout_groups (name) VALUES (?)", [newSetGroup]);
            groupId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        }

        // Resolve Exercise
        let exId;
        const eRow = availableExercises.find(e => e.name.toLowerCase() === newSetExercise.toLowerCase());
        if (eRow) {
            exId = eRow.id;
        } else {
            db.run("INSERT INTO exercises (name) VALUES (?)", [newSetExercise]);
            exId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        }

        // Link
        db.run("INSERT OR IGNORE INTO group_exercises (group_id, exercise_id) VALUES (?,?)", [groupId, exId]);

        // Insert Set
        const nextOrder = sets.length + 1;
        db.run(`
            INSERT INTO sets (workout_id, group_id, exercise_id, set_order, reps, rir, notes)
            VALUES (?, ?, ?, ?, 0, 0, '')
        `, [id, groupId, exId, nextOrder]);

        db.run("COMMIT");
        setNewSetGroup('');
        setNewSetExercise('');
        loadData(); // Refresh everything
    } catch(e) {
        console.error(e);
        db.run("ROLLBACK");
    }
  };

  const updateSet = (setId, field, value) => {
    db.run(`UPDATE sets SET ${field} = ? WHERE id = ?`, [value, setId]);
    setSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: value } : s));
  };

  const deleteSet = (setId) => {
    db.run("DELETE FROM sets WHERE id = ?", [setId]);
    loadData();
  };

  if (!workout) return <Container className="pt-5">Loading...</Container>;

  return (
    <Container className="pb-5">
      <Button variant="link" onClick={() => navigate('/')} className="mb-3 px-0">&larr; Back to Week</Button>
      
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
             <h2 className="mb-0">Editing {workout.day_name}</h2>
             <Form.Check 
               type="switch"
               id="rest-switch"
               label="Rest Day"
               checked={!!workout.is_rest_day}
               onChange={(e) => updateWorkout('is_rest_day', e.target.checked ? 1 : 0)}
             />
          </div>
          
          <Form.Group className="mb-3">
             <Form.Label>Workout Name</Form.Label>
             <Form.Control 
               type="text" 
               value={workout.workout_name || ''} 
               onChange={(e) => updateWorkout('workout_name', e.target.value)}
               placeholder="e.g., Upper Power"
               disabled={!!workout.is_rest_day}
             />
          </Form.Group>
        </Card.Body>
      </Card>

      {!workout.is_rest_day && (
        <>
            <Card className="mb-4">
                <Card.Header>Program</Card.Header>
                <Card.Body>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th style={{width: '50px'}}>#</th>
                                <th>Group</th>
                                <th>Exercise</th>
                                <th style={{width: '100px'}}>Reps</th>
                                <th style={{width: '100px'}}>RIR</th>
                                <th>Notes</th>
                                <th style={{width: '50px'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sets.map((set, idx) => (
                                <tr key={set.id}>
                                    <td>{idx + 1}</td>
                                    <td>{set.group_name}</td>
                                    <td>{set.exercise_name}</td>
                                    <td>
                                        <Form.Control 
                                            size="sm" type="number" value={set.reps} 
                                            onChange={(e) => updateSet(set.id, 'reps', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <Form.Control 
                                            size="sm" type="number" value={set.rir} 
                                            onChange={(e) => updateSet(set.id, 'rir', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <Form.Control 
                                            size="sm" type="text" value={set.notes || ''} 
                                            onChange={(e) => updateSet(set.id, 'notes', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <Button size="sm" variant="danger" onClick={() => deleteSet(set.id)}>x</Button>
                                    </td>
                                </tr>
                            ))}
                            {sets.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center text-muted">No sets programmed yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            <Card className="mb-4 bg-light">
                <Card.Body>
                    <h5>Add Movement</h5>
                    <Row className="g-2">
                        <Col md={4}>
                            <Form.Control 
                                list="group-options"
                                placeholder="Muscle Group (e.g. Chest)"
                                value={newSetGroup}
                                onChange={(e) => setNewSetGroup(e.target.value)}
                            />
                            <datalist id="group-options">
                                {availableGroups.map(g => <option key={g.id} value={g.name} />)}
                            </datalist>
                        </Col>
                        <Col md={6}>
                            <Form.Control 
                                list="exercise-options"
                                placeholder="Exercise (e.g. Bench Press)"
                                value={newSetExercise}
                                onChange={(e) => setNewSetExercise(e.target.value)}
                            />
                             <datalist id="exercise-options">
                                {availableExercises.map(e => <option key={e.id} value={e.name} />)}
                            </datalist>
                        </Col>
                        <Col md={2}>
                            <Button variant="primary" className="w-100" onClick={handleAddSet}>Add Set</Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        </>
      )}
    </Container>
  );
};

export default WorkoutEditor;
