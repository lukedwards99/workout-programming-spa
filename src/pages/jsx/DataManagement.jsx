import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { dataApi } from '../../api/workoutApi';
import '../css/DataManagement.css';

function DataManagement() {
  const [alert, setAlert] = useState(null);
  const [importing, setImporting] = useState(false);
  const [setupFile, setSetupFile] = useState(null);
  const [programFile, setProgramFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState({ setup: '', program: '' });

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleExportSetup = async () => {
    const response = await dataApi.downloadSetup();
    
    if (response.success) {
      showAlert('Setup data exported: ' + response.data.filename);
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleExportProgram = async () => {
    const response = await dataApi.download();
    
    if (response.success) {
      showAlert('Program data exported: ' + response.data.filename);
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleExportAll = async () => {
    const response = await dataApi.downloadAll();
    
    if (response.success) {
      showAlert(`Both files exported: ${response.data.setupFilename} and ${response.data.programFilename}`);
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handlePreview = async () => {
    const setupResponse = await dataApi.exportSetup();
    const programResponse = await dataApi.export();
    
    if (setupResponse.success && programResponse.success) {
      const setupLines = setupResponse.data.csv.split('\n');
      const setupPreview = setupLines.slice(0, 11).join('\n');
      
      const programLines = programResponse.data.csv.split('\n');
      const programPreview = programLines.slice(0, 11).join('\n');
      
      setCsvPreview({ setup: setupPreview, program: programPreview });
      showAlert('Preview loaded (showing first 10 rows of each file)', 'info');
    } else {
      showAlert('Failed to generate preview', 'danger');
    }
  };

  const handleSetupFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setSetupFile(null);
      return;
    }

    if (!file.name.endsWith('.csv')) {
      showAlert('Please upload a CSV file', 'warning');
      e.target.value = '';
      return;
    }

    setSetupFile(file);
  };

  const handleProgramFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setProgramFile(null);
      return;
    }

    if (!file.name.endsWith('.csv')) {
      showAlert('Please upload a CSV file', 'warning');
      e.target.value = '';
      return;
    }

    setProgramFile(file);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!setupFile || !programFile) {
      showAlert('Please select both setup and program CSV files', 'warning');
      return;
    }

    if (!window.confirm('⚠️ IMPORTANT: Importing will completely replace all existing data (including days, workout groups, exercises, and all workout data). This action cannot be undone. Are you sure you want to continue?')) {
      return;
    }

    setImporting(true);

    try {
      const setupText = await setupFile.text();
      const programText = await programFile.text();
      
      const response = await dataApi.importAll(setupText, programText);
      
      if (response.success) {
        showAlert(response.message, 'success');
        // Clear file inputs
        setSetupFile(null);
        setProgramFile(null);
        // Reset file input elements
        document.getElementById('setupFileInput').value = '';
        document.getElementById('programFileInput').value = '';
      } else {
        showAlert(response.error, 'danger');
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
        <Col md={12}>
          <Card>
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">Export Data</h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="info" className="mb-3">
                <strong>Note:</strong> Your workout data is stored in two tightly coupled files. 
                Both files must be exported and imported together for data consistency.
              </Alert>

              <p>
                Download your workout data as CSV files. You can edit these files in Excel or 
                Google Sheets, then re-upload them to update your program.
              </p>
              
              <Row className="mb-3">
                <Col md={6}>
                  <h6>Setup Data (Workout Groups & Exercises)</h6>
                  <p className="small text-muted">
                    Contains all your workout groups and exercises library. This is the foundation 
                    of your program.
                  </p>
                  <Button 
                    variant="success" 
                    className="w-100 mb-2"
                    onClick={handleExportSetup}
                  >
                    Download Setup Data
                  </Button>
                </Col>
                
                <Col md={6}>
                  <h6>Program Data (Days, Sets & Schedule)</h6>
                  <p className="small text-muted">
                    Contains your weekly schedule, all sets, reps, RIR, and how workout groups 
                    are assigned to days.
                  </p>
                  <Button 
                    variant="success" 
                    className="w-100 mb-2"
                    onClick={handleExportProgram}
                  >
                    Download Program Data
                  </Button>
                </Col>
              </Row>

              <div className="d-grid gap-2 mb-3">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={handleExportAll}
                >
                  📦 Download Both Files
                </Button>
                
                <Button 
                  variant="outline-secondary"
                  onClick={handlePreview}
                >
                  Preview Data
                </Button>
              </div>

              {(csvPreview.setup || csvPreview.program) && (
                <div className="mt-3">
                  <Row>
                    {csvPreview.setup && (
                      <Col md={6}>
                        <h6>Setup Data Preview (first 10 rows):</h6>
                        <pre className="csv-preview">{csvPreview.setup}</pre>
                      </Col>
                    )}
                    {csvPreview.program && (
                      <Col md={6}>
                        <h6>Program Data Preview (first 10 rows):</h6>
                        <pre className="csv-preview">{csvPreview.program}</pre>
                      </Col>
                    )}
                  </Row>
                </div>
              )}

              <div className="mt-4">
                <h6>File Descriptions:</h6>
                <ul className="small text-muted">
                  <li><strong>workout-setup-YYYY-MM-DD.csv</strong> - Workout groups and exercises</li>
                  <li><strong>workout-program-YYYY-MM-DD.csv</strong> - Days, sets, reps, RIR, and assignments</li>
                  <li>Both files are required for a complete backup</li>
                  <li>Open with Excel, Google Sheets, or any CSV editor</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Import Section */}
      <Row className="mt-4">
        <Col md={12}>
          <Card>
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">Import Data</h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="danger" className="mb-3">
                <strong>⚠️ WARNING:</strong> Importing will completely replace ALL existing data, 
                including days, workout groups, exercises, and all workout data. Both files must 
                be from the same export session. This action cannot be undone.
              </Alert>

              <p>
                Upload both CSV files to restore or update your complete workout program. 
                Both files are required and must be provided together.
              </p>

              <Form onSubmit={handleFileUpload}>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>
                        <strong>1. Setup Data File</strong> (workout-setup-*.csv)
                      </Form.Label>
                      <Form.Control
                        id="setupFileInput"
                        type="file"
                        accept=".csv"
                        onChange={handleSetupFileSelect}
                        disabled={importing}
                      />
                      {setupFile && (
                        <Form.Text className="text-success">
                          ✓ {setupFile.name}
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>
                        <strong>2. Program Data File</strong> (workout-program-*.csv)
                      </Form.Label>
                      <Form.Control
                        id="programFileInput"
                        type="file"
                        accept=".csv"
                        onChange={handleProgramFileSelect}
                        disabled={importing}
                      />
                      {programFile && (
                        <Form.Text className="text-success">
                          ✓ {programFile.name}
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-grid">
                  <Button 
                    type="submit"
                    variant="primary" 
                    size="lg"
                    disabled={importing || !setupFile || !programFile}
                  >
                    {importing ? 'Importing...' : '📥 Import Both Files'}
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
                  <li>Export both files using the "Download Both Files" button above</li>
                  <li>Edit the CSV files in Excel or Google Sheets as needed</li>
                  <li>Save both files as CSV format</li>
                  <li>Select both files using the inputs above</li>
                  <li>Click "Import Both Files" to replace all data</li>
                  <li>Wait for the import to complete (may take a moment for large programs)</li>
                </ol>
                
                <Alert variant="warning" className="mb-0 mt-3">
                  <strong>Important:</strong> Both files must be from the same export session. 
                  The setup file contains IDs that the program file references. Mixing files 
                  from different exports may cause import errors.
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
                  <h6>1. Export Both Files</h6>
                  <p className="small">
                    Click "Download Both Files" to export your complete workout program. 
                    You'll get two files: setup data (workout groups & exercises) and 
                    program data (days, sets, schedule).
                  </p>
                </Col>
                
                <Col md={4} className="mb-3">
                  <h6>2. Edit As Needed</h6>
                  <p className="small">
                    Open the CSV files in Excel, Google Sheets, or any spreadsheet software. 
                    Update as needed, but keep the header rows intact. Be careful not to 
                    change IDs in the setup file.
                  </p>
                </Col>
                
                <Col md={4} className="mb-3">
                  <h6>3. Import Both Files Together</h6>
                  <p className="small">
                    Select both edited CSV files and click "Import Both Files". Your entire 
                    program will be replaced with the data from these files. Perfect for 
                    backing up and restoring your program.
                  </p>
                </Col>
              </Row>

              <Alert variant="info" className="mb-0 mt-3">
                <strong>Tip:</strong> Use export/import to create program variations, backup 
                before making changes, or transfer your program to another device. Always keep 
                both files together!
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
    </Container>
  );
}

export default DataManagement;
