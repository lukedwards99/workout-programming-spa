import { useState, useEffect } from 'react';
import { useParams, Outlet, Link, NavLink } from 'react-router-dom';
import { programsApi } from '../api/programsApi';
import { activateProgram, deactivateProgram } from '../db/databaseService';

export default function ProgramPage() {
  const { programId } = useParams();
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    setActivated(false);
    setError(null);
    const pid = Number(programId);
    const p = programsApi.get(pid);
    if (!p) {
      setError('Program not found.');
      return;
    }
    setProgram(p);
    activateProgram(pid)
      .then(() => setActivated(true))
      .catch((e) => setError(e.message));

    return () => {
      deactivateProgram().catch(console.error);
    };
  }, [programId]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!program || !activated) return <div className="empty-state"><p>Loading...</p></div>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Programs</Link><span>/</span><strong>{program.name}</strong>
      </div>

      <div className="page-header">
        <h1>{program.name}</h1>
      </div>
      {program.notes && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{program.notes}</p>}

      <div className="program-tabs">
        <NavLink to={`/programs/${program.id}`} end>Mesocycles</NavLink>
        <NavLink to={`/programs/${program.id}/exercises`}>Exercises</NavLink>
        <NavLink to={`/programs/${program.id}/data`}>Data</NavLink>
      </div>

      <Outlet />
    </>
  );
}
