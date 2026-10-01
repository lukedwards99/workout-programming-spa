# LiftLog

LiftLog is a personal training and coaching workspace for building programs and recording workouts. The primary user is Luke, currently testing the application alone and simulating different accounts before broader use.

## Product truth

- Preserve the hierarchy: workspace → independently owned program → mesocycle → workout → exercise block → strength or cardio sets.
- Planned and executed values live together. Programs, mesocycles, and workouts can be copied, with executed values included only by explicit choice.
- Adding a client to an organization roster automatically creates their one client-owned space. The organization holds the roster; the client's programs, workout results, and exercise library stay in the client space.
- Each client has at most one active assigned coach. The staff-only assignment directory shows the client, assigned coach, and client space together. Coaches can claim unassigned clients and release their own assignments; organization owners and administrators can force release and choose another coach.
- Client-space access is derived on every request. Releasing an assignment immediately removes the coach's access while retaining the client's space and training data. Clients see their programs and log their execution; assigned coaches program for them; owners and platform admins manage access.
- Coaches can create multiple private personal spaces for their own training and programming. Personal spaces and client spaces have separate exercise libraries. Copying a program into another space creates independent exercise and variation references there, so later library changes do not alter the source.
- Cloudflare Workers serves the same-origin application/API, D1 stores data, and Cloudflare Access verifies hosted identity.
- A temporary test identity wrapper must allow selecting different email accounts. It must preserve server-side authorization and clearly communicate the simulated identity.
- Existing hosted deployment lanes reset their disposable databases on deployment. This rewrite does not change that policy.
- The client-space model updates the initial schema for a reset database only. No migration or backfill of existing data is part of this change.

## Requested change

Replace the current UI with a coherent new interface, using the existing application as functional inspiration. Preserve workout creation and management behavior. Deliver a PR into dev with screenshots and leave a local server running for pre-merge testing.

## Usage and constraints

Frequent programming at a desktop, plus workout entry on a phone. Favor clear navigation, readable set values, quick program access, and explicit save/error feedback. Avoid decorative elements that compete with the workout. No external imagery is required for the operational interface.

## Stack

React, TypeScript, Vite, Hono, Cloudflare Workers and D1. Existing Cloudflare Access protects hosted app invocations. Local data persists across normal restarts. Browser checks use Playwright and Worker checks use Vitest.

## Confirmed session direction

Luke selected a focused training workspace for fast program editing and workout logging, and approved the training-studio direction: warm paper surfaces, a dark green navigation rail, clear program rows, and a planned/actual set-entry sheet. Hosted dev switching is a stated implementation assumption, restricted to Luke's real Access administrator; production uses real identity. No standing build-workflow preference is recorded.
