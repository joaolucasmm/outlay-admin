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

**Onboarding**:
Bringing a new customer onto the platform: the Support Operator fills the wizard (company, locale, employees), then provisions the Tenant.

**Onboarding Draft**:
The wizard's saved, unfinished input, kept in the browser until provisioning succeeds or it is discarded. One per browser.

**Provisioning**:
The steps that turn an Onboarding Draft into an active Tenant: create it, apply the Category Template, import employees, activate. A Tenant whose provisioning stopped halfway stays `provisioning`.

**Category Template**:
A ready-made set of Expense Categories and Policy Rules applied during provisioning: Standard or Empty.

**Audit Event**:
An immutable record that an actor changed something, with what it looked like before and after.
_Avoid_: Log entry, history item

### Expense program

**Expense Category**:
A kind of spending a Tenant reimburses (Meals, Travel…), identified by a code that never changes. Categories are deactivated, never deleted.
_Avoid_: Expense type, delete (for categories)

**Policy Rule**:
The spending rule for one Expense Category and one Employee Role: the limit per expense, the amount above which a receipt is required, and how many approval levels it needs. No rule for a pair means the category is not allowed for that role.
_Avoid_: Policy (alone), limit (for the whole rule)

**Policy Grid**:
All of a Tenant's Policy Rules, laid out category × Employee Role and saved as one unit.

**Expense**:
A reviewed spending claim (amount, currency and whether a readable receipt is attached) that the policy engine judges. It is built after the user checks the receipt extraction.
_Avoid_: Receipt (the receipt is evidence, not the expense)

**Policy Check**:
The engine's verdict on an Expense: compliant, needs approval or violation, with one finding per check that explains it.

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

**Employee Import**:
Adding Employees in bulk from a CSV file. It creates only (no updates), emails are unique per Tenant, and the server accepts all rows or none.
_Avoid_: Sync, upload (for the whole operation)

**Employee Role**:
An Employee's seniority (employee, manager or director). Policy rules are set per Employee Role.
_Avoid_: Role (alone), Admin Role
