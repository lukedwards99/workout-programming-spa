# Using LiftLog

## Accounts and spaces

Accounts are manually provisioned during beta. There is no public signup. Locally, choose an administrator, either coach, or a client to test role-specific access.

Hosted beta testers sign in using a Cloudflare email one-time PIN. The administrator must create their account in **Admin Users** and add the same email to that environment's Cloudflare Access allowlist before they can test. See [invitation instructions](deployment.md#invite-beta-testers). Hosted deployments reset app accounts and training data, so manually provisioned accounts must be re-created after each deployment.

An **organization roster** contains owners, coaches, and clients. Adding a client to the roster automatically creates their **one client space**. All of their programs, results, and exercise library belong to that space. Clients can enter only their own space.

Coaches can have many assigned client spaces and create multiple **personal spaces** for training, templates, or other coaching work. Personal spaces are private to their creator and platform admins. **Spaces** and the **Space** picker separate **My spaces**, **Client spaces**, and **Team**. Use **Create personal space** for work without a client attached. Administrators see other users' personal spaces in a separate group. Owners can enter client spaces belonging to their organization; platform admins can enter all spaces. Only platform admins can create teams (organization rosters); their roster tools and existing shared programming stay under **Team**. Clients land directly in their single training space.

Client spaces cannot be deleted or have members added manually. Organizations containing client spaces cannot be deleted. A personal space can be deleted by its owner or an admin after typing its exact name.

## Client assignments

**Client assignments** is available to coaches, organization owners, and admins. It lists each active client, assigned coach, organization, and client space. Search by client or coach, or filter to **My clients** and **Unassigned**.

A coach can **Assign to me** when no coach is assigned. Each client has at most one active coach. The **Assign coach** dialog shows the client and their existing space alongside the coach choice. Assignment confirmation identifies the client, coach, and space and offers **Open client space**. Assigning a coach grants access to the existing client space; it never replaces that space. The assigned coach can open it to view programs, plan training, and maintain its library.

**Release client** returns the client to the unassigned list and removes the coach’s access immediately. It preserves the client’s space, programs, results, and exercises. Only an organization owner or platform admin can **Force release** another coach’s client or use **Assign coach** to select a coach from the organization. Coaches cannot claim someone who is already assigned.

Admins can **Suspend** a client’s organization membership from **Admin Users**. This releases their assignment and disables access while preserving the space and all training data. **Reactivate** restores the membership; the client can then be claimed again. Client roles stay attached to their dedicated space.

## Programs and copying

Programs can be current or archived, contain mesocycles, and contain workouts. Programs in a client space belong to that client automatically.

Coaches, owners, and admins can copy a complete program into any space they can plan in. Select a **Destination space** in the copy dialog. Referenced exercises and variations are copied into that space’s library as independent entries. Each copy is independent; edits in one space cannot alter the source space. Mesocycles and individual workouts can be copied between programs within the active space.

Copy dialogs ask whether to include executed values and athlete notes. This option is off by default.

## Exercise library

Exercise groups, exercises, and variations belong to the selected space and can be reused across its programs. Owners and assigned coaches can maintain the library. Clients can view it. Items referenced by programs are protected from deletion.

## Planned and executed values

The workout table shows planned and executed values together on each set. Owners and admins can edit all fields. Coaches can edit planned fields in their personal and assigned client spaces. Clients can edit executed fields only on their own programs. Strength and cardio totals are summarized across each mesocycle.
