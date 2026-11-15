# Outlay Admin — Domain Glossary

## Tenant

One customer company and its single corporate expense program. There is no separate "program" entity: a Tenant _is_ the program. Every category, policy rule, employee and audit event belongs to exactly one Tenant.

## Admin Role

The role of a person using the console. It is either Support Operator or Program Admin. The role switcher in the header changes the Admin Role.

## Support Operator

An Admin Role on the vendor side. A Support Operator sees all Tenants, creates and onboards them, and runs lifecycle actions (suspend, reactivate, deprovision).

## Program Admin

An Admin Role on the customer side, scoped to one Tenant. A Program Admin manages that Tenant's categories, policy rules and employees, and checks receipts against policy.

## Current Tenant

The Tenant the console is acting on right now, chosen with the tenant switcher. For a Program Admin, it is the Tenant they administer. For a Support Operator, it is the Tenant whose pages they are viewing.

## Employee

A person covered by a Tenant's expense program. Employees are not console users: they never sign in here. They are only the subjects of policy rules.

## Employee Role

The seniority of an Employee: employee, manager or director. Policy rules are set per Employee Role. Never confuse it with the Admin Role.
