# Outlay Admin

An admin console where a vendor's support team runs customer Tenants, and each Tenant's admins configure their corporate expense program.

## Language

### Tenants and lifecycle

**Tenant**:
One customer company and its single corporate expense program. A Tenant _is_ the program: every category, policy rule, employee and audit event belongs to exactly one Tenant.
_Avoid_: Program (as an entity), customer account, organization

**Tenant Status**:
Where a Tenant is in its lifecycle: provisioning, active, suspended or deprovisioned.

**Lifecycle Action**:
A command that moves a Tenant between statuses: activate, suspend, reactivate or deprovision. Only a Support Operator may run one.
_Avoid_: Transition (for the command itself; a transition is the resulting status change)

**Deprovision**:
The final Lifecycle Action: it closes a suspended Tenant for good. The Tenant and its history are kept, never erased.
_Avoid_: Delete, remove

**Audit Event**:
An immutable record that an actor changed something, with what it looked like before and after.
_Avoid_: Log entry, history item

### People and access

**Admin Role**:
The role of a console user: Support Operator or Program Admin.
_Avoid_: Role (alone, ambiguous with Employee Role), user type

**Support Operator**:
An Admin Role on the vendor side. Sees all Tenants, creates and onboards them, and runs Lifecycle Actions.
_Avoid_: Support agent, superadmin

**Program Admin**:
An Admin Role on the customer side, scoped to exactly one Tenant. Manages that Tenant's categories, policy rules and employees, and checks receipts against policy.
_Avoid_: Tenant admin, customer admin

**Persona**:
A demo identity to sign in as: the single Support Operator, or the Program Admin of a given Tenant. The persona decides the Admin Role and, for a Program Admin, the Tenant.
_Avoid_: User, account, login

**Current Tenant**:
The Tenant the console is acting on. For a Program Admin, it is always their own Tenant. For a Support Operator, it is the Tenant they chose to view.

**Employee**:
A person covered by a Tenant's expense program. Employees never use the console: they are only the subjects of policy rules.
_Avoid_: User, member

**Employee Role**:
An Employee's seniority (employee, manager or director). Policy rules are set per Employee Role.
_Avoid_: Role (alone), Admin Role
