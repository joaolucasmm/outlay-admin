import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { readFileText } from '../../../shared/lib/files';
import { adminOf, signedInAs } from '../../../test/personas';
import { renderApp } from '../../../test/renderApp';

const openImport = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = screen.getByRole('button', { name: 'Import CSV' });
  await waitFor(() => {
    expect(button).toBeEnabled(); // once the tenant (and its status) has loaded
  });
  await user.click(button);
  return screen.getByRole('dialog', { name: 'Import employees' });
};

const renderEmployees = async (tenantId = 'tnt_bluefin') => {
  const utils = renderApp(`/t/${tenantId}/employees`, signedInAs(adminOf(tenantId)));
  await screen.findByRole('table', { name: 'Employees' });
  return { ...utils, user: userEvent.setup() };
};

const rowCount = () =>
  within(screen.getByRole('table', { name: 'Employees' })).getAllByRole('row').length - 1;

const csvFile = (text: string, name = 'team.csv') => new File([text], name, { type: 'text/csv' });

describe('EmployeesPage', () => {
  it('lists employees a page at a time', async () => {
    const { user } = await renderEmployees();
    await screen.findByRole('table', { name: 'Employees' });
    expect(rowCount()).toBe(10);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => {
      expect(rowCount()).toBe(14);
    });
  });

  it('searches and filters by role', async () => {
    const { user } = await renderEmployees();
    await screen.findByRole('table', { name: 'Employees' });

    await user.selectOptions(screen.getByLabelText('Role'), 'Director');
    await waitFor(() => {
      expect(rowCount()).toBe(1);
    });

    await user.selectOptions(screen.getByLabelText('Role'), 'All roles');
    await user.type(screen.getByLabelText('Search employees'), 'zzz');
    expect(await screen.findByText('No employees match your filters.')).toBeInTheDocument();
  });

  it('imports a CSV, moving rows the server rejects to the error list', async () => {
    const { user } = await renderEmployees();
    const dialog = await openImport(user);

    await user.upload(
      within(dialog).getByLabelText('Employee CSV file'),
      csvFile(
        'name,email,role,costCenter\n' +
          'Nova Pessoa,nova@bluefin.example,employee,OPS\n' +
          'Ana Again,ana.souza@bluefin.example,manager,OPS\n' +
          'Broken,broken,ceo,OPS\n',
      ),
    );
    expect(await within(dialog).findByText(/2 valid, 1 with errors/)).toBeInTheDocument();

    // The client can't know Ana already exists: the server says so, and nothing is imported.
    await user.click(within(dialog).getByRole('button', { name: 'Import 2 employees' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '1 of 2 employees are invalid. Nothing was imported.',
    );
    expect(within(dialog).getByText(/1 valid, 2 with errors/)).toBeInTheDocument();
    expect(
      within(dialog).getByText('An employee with this email already exists.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Import 1 employee' }));
    expect(await screen.findByText('1 employee imported.')).toBeInTheDocument();
    expect(db.employees('tnt_bluefin').some((e) => e.email === 'nova@bluefin.example')).toBe(true);
  });

  it('downloads the error report and the template', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = (blob: Blob) => {
      created.push(blob);
      return 'blob:report';
    };
    URL.revokeObjectURL = () => undefined;
    const { user } = await renderEmployees();
    const dialog = await openImport(user);

    await user.upload(
      within(dialog).getByLabelText('Employee CSV file'),
      csvFile('name,email,role,costCenter\nBroken,broken,ceo,OPS\n'),
    );
    await user.click(await within(dialog).findByRole('button', { name: 'Download error report' }));
    await user.click(within(dialog).getByRole('button', { name: 'Download template' }));

    expect(created).toHaveLength(2);
    expect(await readFileText(created[0] ?? new Blob())).toContain('2,Broken,broken,ceo,OPS');
    expect(await readFileText(created[1] ?? new Blob())).toContain('name,email,role,costCenter');
  });

  it('rejects a file without the expected columns', async () => {
    const { user } = await renderEmployees();
    const dialog = await openImport(user);

    await user.upload(within(dialog).getByLabelText('Employee CSV file'), csvFile('a,b\n1,2\n'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Missing columns');
    expect(within(dialog).getByRole('button', { name: 'Import 0 employees' })).toBeDisabled();
  });

  it('is read-only for a suspended tenant', async () => {
    await renderEmployees('tnt_harbor');
    expect(await screen.findByRole('note')).toHaveTextContent('read-only');
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeDisabled();
  });
});
