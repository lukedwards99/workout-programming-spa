import { Link } from 'react-router-dom';

export default function AboutPage() {
  return <>
    <div className="breadcrumb"><Link to="/">Programs</Link><span>/</span>About</div>
    <div className="page-header"><div><h1>About LiftLog</h1><p className="page-subtitle">A coach–client workout programming proof of concept.</p></div></div>
    <div className="card"><h2>Local Cloudflare architecture</h2><p>React and the Hono Worker run together through Cloudflare’s Vite integration. All application data is stored in local D1, and the same-origin API enforces workspace and role authorization.</p><p>Beta accounts are provisioned manually. The development-only persona picker stands in for a future external identity provider without storing passwords or allowing public signup.</p></div>
  </>;
}
