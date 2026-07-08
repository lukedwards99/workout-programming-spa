import { useState, useEffect } from 'react';
import { useParams, Outlet, Link, NavLink } from 'react-router-dom';
import { programsApi } from '../api/programsApi';

export default function ProgramPage() {
  const { programId } = useParams();
  const [program, setProgram] = useState(null);

  useEffect(() => {
    const p = programsApi.get(Number(programId));
    if (p) setProgram(p);
  }, [programId]);

  if (!program) return <div className="empty-state"><p>Program not found.</p></div>;

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
