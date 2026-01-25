import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { downloadCSV, importFromCSV, exportToCSV } from '../../db/dataService';
import '../css/DataManagement.css';

function DataManagement() {
  const [alert, setAlert] = useState(null);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState('');

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleExport = () => {
    try {
      downloadCSV();
      showAlert('CSV file downloaded successfully!');
    } catch (error) {
      showAlert('Error exporting data: ' + error.message, 'danger');
    }
  };

  const handlePreview = () => {
    try {
      const csv = exportToCSV();
      const lines = csv.split('\n');
      const preview = lines.slice(0, 11).join('\n'); // Header + first 10 rows
      setCsvPreview(preview);
      showAlert('Preview loaded (showing first 10 rows)', 'info');
    } catch (error) {
      showAlert('Error generating preview: ' + error.message, 'danger');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showAlert('Please upload a CSV file', 'warning');
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const result = await importFromCSV(text);
      
      showAlert(
        `Successfully imported ${result.rowCount} rows. Please refresh the page or navigate to see updated data.`,
        'success'
      );
      
      // Clear the file input
      e.target.value = '';
    } catch (error) {
      showAlert('Error importing CSV: ' + error.message, 'danger');
    } finally {
      setImporting(false);
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
        <Col md={6}>
          <Card className="h-100">
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">Export Data</h4>
            </Card.Header>
            <Card.Body>
              <p>
                Download your entire workout program as a CSV file. You can use this file 
                throughout the week to track your workouts, then re-upload it to update your 
                program.
              </p>
              
              <div className="d-grid gap-2">
                <Button 
                  variant="success" 
                  size="lg"
                  onClick={handleExport}
                >
                  Download CSV
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
                  <h6>Preview (first 10 rows):</h6>
                  <pre className="csv-preview">{csvPreview}</pre>
                </div>
              )}

              <div className="mt-4">
                <h6>CSV Format:</h6>
                <ul className="small text-muted">
                  <li>All workout data in a single table</li>
                  <li>Columns: day_name, day_order, workout_group_name, exercise_name, 
                      exercise_notes, set_order, reps, rir, set_notes</li>
                  <li>Open with Excel, Google Sheets, or any CSV editor</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Import Section */}
        <Col md={6}>
          <Card className="h-100">
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">Import Data</h4>
            </Card.Header>
            <Card.Body>
              <p>
                Upload a CSV file to update your workout program. The file should match 
                the format of the exported CSV file.
              </p>

              <Alert variant="warning">
                <strong>Warning:</strong> Importing will clear all existing sets and 
                rebuild from the CSV file. Workout groups and exercises will be preserved 
                or created as needed.
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label>Select CSV File</Form.Label>
                <Form.Control
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={importing}
                />
              </Form.Group>

              {importing && (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Importing...</span>
                  </div>
                  <p className="mt-2">Importing data, please wait...</p>
                </div>
              )}

              <div className="mt-4">
                <h6>Import Instructions:</h6>
                <ol className="small text-muted">
                  <li>Export your current data to get the correct format</li>
                  <li>Edit the CSV file in Excel or Google Sheets</li>
                  <li>Save the file as CSV</li>
                  <li>Upload the file using the button above</li>
                  <li>Refresh the page to see your updated program</li>
                </ol>
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
                  <h6>1. Export</h6>
                  <p className="small">
                    Click "Download CSV" to export your current workout program. 
                    The file will contain all your sets in a single table format.
                  </p>
                </Col>
                
                <Col md={4} className="mb-3">
                  <h6>2. Edit</h6>
                  <p className="small">
                    Open the CSV file in Excel, Google Sheets, or any spreadsheet software. 
                    Update reps, RIR, notes, or add new rows. Keep the header row intact.
                  </p>
                </Col>
                
                <Col md={4} className="mb-3">
                  <h6>3. Import</h6>
                  <p className="small">
                    Upload the edited CSV file. Your program will be updated with the new data. 
                    This is perfect for planning ahead or tracking progress week-to-week.
                  </p>
                </Col>
              </Row>

              <Alert variant="info" className="mb-0 mt-3">
                <strong>Tip:</strong> You can use this feature to create weekly variations 
                of your program. Export at the start of the week, make changes for next week, 
                and import when ready!
              </Alert>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DataManagement;
