import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
export default function AboutPage() {
  return <>
    <div className="breadcrumb"><Link to="/">Programs</Link><Icon name="chevron" /><span>About</span></div>
    <div className="page-header"><div><h1>A place for the work.</h1><p className="page-subtitle">LiftLog brings programming and workout logging together.</p></div></div>
    <section className="about-content"><h2>From the bigger picture to every set</h2><p>Build a program, organize it into mesocycles, and add your workouts. Your planned and recorded strength and cardio values stay together, so the plan and what happened are easy to compare.</p><h2>Your account, your training</h2><p>Cloudflare Access verifies hosted sign-in. Workspaces, program ownership, and coach–client relationships determine what each account can see and edit. Your data lives in Cloudflare D1.</p><h2>Try a different perspective</h2><p>The temporary test switcher lets you choose another email and use that account’s permissions. It runs locally and on the dev app after the allowed owner signs in. The account strip always shows the current test identity.</p><Link className="text-link" to="/">Back to your programs <Icon name="arrow" /></Link></section>
  </>;
}
