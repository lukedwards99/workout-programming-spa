import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { dataApi } from '../../api/workoutApi';
import * as csvService from '../../services/csvService';
import '../css/DataManagement.css';

function DataManagement() {
  const [alert, setAlert] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dataFile, setDataFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState('');

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
  };

  const handleExportData = async () => {
    const result = await csvService.downloadAllData();
    
    if (result.success) {
      showAlert('Data exported: ' + result.filename);
    } else {
      showAlert(result.error, 'danger');
    }
  };

  const handlePreview = async () => {
    try {
      const csv = await csvService.exportAllData();
      const lines = csv.split('\n');
      const preview = lines.slice(0, 21).join('\n');
      
      setCsvPreview(preview);
      showAlert('Preview loaded (showing first 20 rows)', 'info');
    } catch (error) {
      showAlert('Failed to generate preview: ' + error.message, 'danger');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setDataFile(null);
      return;
    }

    if (!file.name.endsWith('.csv')) {
      showAlert('Please upload a CSV file', 'warning');
      e.target.value = '';
      return;
    }

    setDataFile(file);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!dataFile) {
      showAlert('Please select a CSV file', 'warning');
      return;
    }

    if (!window.confirm('⚠️ IMPORTANT: Importing will completely replace all existing data (including days, workout groups, exercises, and all workout data). This action cannot be undone. Are you sure you want to continue?')) {
      return;
    }

    setImporting(true);

    try {
      const text = await dataFile.text();
      
      const result = await csvService.importAllData(text);
      
      if (result.success) {
        const message = `Successfully imported: ${result.counts.workoutGroups} workout groups, ${result.counts.exercises} exercises, ${result.counts.days} days, ${result.counts.dayExercises} day exercises, ${result.counts.sets} sets`;
        showAlert(message, 'success');
        // Clear file input
        setDataFile(null);
        // Reset file input element
        document.getElementById('dataFileInput').value = '';
        setCsvPreview('');
      } else {
        showAlert(result.error, 'danger');
      }
    } catch (error) {
      showAlert('Error importing CSV: ' + error.message, 'danger');
    } finally {
      setImporting(false);
    }
  };

  const handleClearWorkoutData = async () => {
    if (!window.confirm('Are you sure you want to clear all workout data? This will delete all sets for the week but keep your workout groups and exercises. This action cannot be undone.')) {
      return;
    }

    const response = await dataApi.clearWorkoutData();
    
    if (response.success) {
      showAlert('All workout data cleared successfully. Your workout groups and exercises are preserved.', 'success');
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('⚠️ DANGER: This will delete EVERYTHING - all days, workout groups, exercises, and workout data. This action cannot be undone. Are you absolutely sure?')) {
      return;
    }

    const response = await dataApi.clearAllData();
    
    if (response.success) {
      showAlert('All data cleared successfully. Database has been completely reset.', 'success');
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleSeedSampleData = async () => {
    if (!window.confirm('This will add sample workout groups, exercises, and 7 days to your database. If data already exists, this may create duplicates. Continue?')) {
      return;
    }

    const response = await dataApi.seedSampleData();
    
    if (response.success) {
      showAlert('Sample data added successfully. Check your setup page to see the new workout groups and exercises.', 'success');
    } else {
      showAlert(response.error, 'danger');
    }
  };

  return (
    <Container className="data-management-page py-4">
      <h1 className="mb-4">Data Management</h1>

      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Row className="g-4">
        {/* Export Section */}
        <Col xl={6}>
          <Card>
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">Export Data</h4>
            </Card.Header>
            <Card.Body>
              <p>
                Download your complete workout program as a single CSV file. This includes:
              </p>
              <ul>
                <li>Workout groups</li>
                <li>Exercises</li>
                <li>Days and schedule</li>
                <li>Sets, reps, and RIR</li>
              </ul>
              
              <p className="text-muted small">
                You can edit this file in Excel or Google Sheets, then re-upload it to update 
                your program.
              </p>

              <div className="d-grid gap-2 mb-3">
                <Button 
                  variant="success" 
                  size="lg"
                  onClick={handleExportData}
                >
                  📦 Download Complete Program
                </Button>
                
                <Button 
                  variant="outline-secondary"
                  onClick={handlePreview}
                >
                  Preview Data
                </Button>
              </div>

              {csvPreview && (
                <div className="mt-3">
                  <h6>Data Preview (first 20 rows):</h6>
                  <pre className="csv-preview">{csvPreview}</pre>
                </div>
              )}

              <div className="mt-4">
                <h6>File Format:</h6>
                <ul className="small text-muted">
                  <li><strong>workout-complete-YYYY-MM-DD.csv</strong> - Complete workout program</li>
                  <li>First rows contain workout groups and exercises</li>
                  <li>Remaining rows contain your program data (days, sets, reps, RIR)</li>
                  <li>Open with Excel, Google Sheets, or any CSV editor</li>
                  <li>Keep the header row intact when editing</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>

      {/* Import Section */}
        <Col xl={6}>
          <Card>
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">Import Data</h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="danger" className="mb-3">
                <strong>⚠️ WARNING:</strong> Importing will completely replace ALL existing data, 
                including days, workout groups, exercises, and all workout data. This action cannot 
                be undone.
              </Alert>

              <p>
                Upload a CSV file to restore or update your complete workout program.
              </p>

              <Form onSubmit={handleFileUpload}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>Select CSV File</strong> (workout-complete-*.csv)
                  </Form.Label>
                  <Form.Control
                    id="dataFileInput"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    disabled={importing}
                  />
                  {dataFile && (
                    <Form.Text className="text-success">
                      ✓ {dataFile.name}
                    </Form.Text>
                  )}
                </Form.Group>

                <div className="d-grid">
                  <Button 
                    type="submit"
                    variant="primary" 
                    size="lg"
                    disabled={importing || !dataFile}
                  >
                    {importing ? 'Importing...' : '📥 Import Complete Program'}
                  </Button>
                </div>
              </Form>

              {importing && (
                <div className="text-center mt-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Importing...</span>
                  </div>
                  <p className="mt-2">Importing data, please wait...</p>
                </div>
              )}

              <div className="mt-4">
                <h6>Import Instructions:</h6>
                <ol className="small text-muted">
                  <li>Export your data using the "Download Complete Program" button</li>
                  <li>Edit the CSV file in Excel or Google Sheets as needed</li>
                  <li>Save the file as CSV format</li>
                  <li>Select the file using the input above</li>
                  <li>Click "Import Complete Program" to replace all data</li>
                  <li>Wait for the import to complete (may take a moment for large programs)</li>
                </ol>
                
                <Alert variant="info" className="mb-0 mt-3">
                  <strong>Tip:</strong> The CSV file has a specific structure with workout groups 
                  and exercises in the first rows, followed by program data. Keep this structure 
                  intact when editing.
                </Alert>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Instructions */}
      <Row className="mt-4">
        <Col>
          <Card className="bg-light">
            <Card.Body>
              <h5 className="mb-3">How to Use CSV Export/Import</h5>
              
              <Row>
                <Col md={4} className="mb-3">
                  <h6>1. Export Your Program</h6>
                  <p className="small">
                    Click "Download Complete Program" to export your entire workout program as a 
                    single CSV file. This includes workout groups, exercises, days, and all sets.
                  </p>
                </Col>
                
                <Col md={4} className="mb-3">
                  <h6>2. Edit As Needed</h6>
                  <p className="small">
                    Open the CSV file in Excel, Google Sheets, or any spreadsheet software. 
                    Update as needed, but keep the header row and overall structure intact.
                  </p>
                </Col>
                
                <Col md={4} className="mb-3">
                  <h6>3. Import Your Changes</h6>
                  <p className="small">
                    Select the edited CSV file and click "Import Complete Program". Your entire 
                    program will be replaced with the data from the file.
                  </p>
                </Col>
              </Row>

              <Alert variant="info" className="mb-0 mt-3">
                <strong>Tip:</strong> Use export/import to backup your program, make bulk changes 
                in a spreadsheet, create program variations, or transfer your program to another 
                device.
              </Alert>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Clear Data Section */}
      <Row className="mt-4">
        <Col>
          <Card className="border-danger">
            <Card.Header className="bg-danger text-white">
              <h5 className="mb-0">Danger Zone</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6} className="mb-3 mb-md-0">
                  <h6>Clear Workout Data Only</h6>
                  <p className="text-muted mb-3 small">
                    Remove all workout data (days, sets, and day assignments) for the week. 
                    This preserves your workout groups and exercises library.
                  </p>
                  <Button variant="warning" onClick={handleClearWorkoutData}>
                    Clear Workout Data
                  </Button>
                </Col>
                
                <Col md={6}>
                  <h6>Clear Everything</h6>
                  <p className="text-muted mb-3 small">
                    Complete database reset. Removes ALL data including days, workout groups, 
                    exercises, and all workout data. Use this to start completely fresh.
                  </p>
                  <Button variant="danger" onClick={handleClearAllData}>
                    ⚠️ Clear All Data
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Seed Sample Data Section */}
      <Row className="mt-4">
        <Col>
          <Card className="border-primary">
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">Sample Data</h5>
            </Card.Header>
            <Card.Body>
              <h6>Add Sample Workout Data</h6>
              <p className="text-muted mb-3 small">
                This will add sample workout groups (Chest, Back, Legs, Shoulders, Arms, Cardio, Rest), 
                corresponding exercises, and create 7 days (Monday-Sunday). Use this to quickly 
                populate your database with example data to get started.
              </p>
              <Alert variant="warning" className="mb-3 small">
                <strong>Note:</strong> If you already have data, this may create duplicates. 
                Consider clearing all data first if you want a clean sample setup.
              </Alert>
              <Button variant="primary" onClick={handleSeedSampleData}>
                Add Sample Data
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DataManagement;
