import type { Employee, EmployeeRole } from 'contracts';
import { seedTenants } from './seed';

const FIRST = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Felipe',
  'Gabi',
  'Hugo',
  'Iris',
  'João',
  'Kai',
  'Lara',
  'Marta',
  'Nico',
];
const LAST = [
  'Souza',
  'Lima',
  'Costa',
  'Pereira',
  'Almeida',
  'Rocha',
  'Nunes',
  'Moreira',
  'Barros',
  'Teixeira',
  'Campos',
  'Ramos',
  'Freitas',
  'Pinto',
];
const CENTERS = ['OPS', 'SALES', 'FIN', 'ENG'];

/** Deterministic employees: 1 director, ~25% managers, the rest employees. */
function employeesFor(tenantId: string, count: number): Employee[] {
  const slug = tenantId.replace(/^tnt_/, '');
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST[i % FIRST.length] ?? 'Ana';
    const last = LAST[(i * 5) % LAST.length] ?? 'Souza';
    const role: EmployeeRole = i === 0 ? 'director' : i % 4 === 1 ? 'manager' : 'employee';
    return {
      id: `emp_${slug}_${String(i + 1).padStart(3, '0')}`,
      tenantId,
      name: `${first} ${last}`,
      // "João" → "joao": decompose accents, then drop anything that isn't a-z or a dot.
      email:
        `${first}.${last}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[^a-z.]/g, '') + `@${slug}.example`,
      role,
      costCenter: CENTERS[i % CENTERS.length] ?? 'OPS',
    };
  });
}

/** Bluefin gets enough employees to need "Load more"; the provisioning tenant gets none. */
export const seedEmployees: Employee[] = seedTenants
  .filter((t) => t.status !== 'provisioning')
  .flatMap((t, i) => employeesFor(t.id, t.id === 'tnt_bluefin' ? 14 : 5 + (i % 4)));
