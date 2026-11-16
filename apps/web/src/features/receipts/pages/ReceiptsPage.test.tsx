import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/node';
import { adminOf, signedInAs } from '../../../test/personas';
import { renderApp } from '../../../test/renderApp';

beforeEach(() => {
  // The sample PNGs are static files served by Vite; tests only need some bytes.
  server.use(
    http.get('*/sample-receipts/:file', () =>
      HttpResponse.arrayBuffer(new Uint8Array([137, 80, 78, 71]).buffer, {
        headers: { 'Content-Type': 'image/png' },
      }),
    ),
  );
  URL.createObjectURL = () => 'blob:receipt-preview';
  URL.revokeObjectURL = () => undefined;
});

const renderReceipts = async () => {
  const utils = renderApp('/t/tnt_bluefin/receipts', signedInAs(adminOf('tnt_bluefin')));
  await screen.findByRole('heading', { name: 'Receipts' });
  return { ...utils, user: userEvent.setup() };
};

type User = ReturnType<typeof userEvent.setup>;

const review = () => screen.getByRole('form', { name: 'Expense review' });
const result = () => screen.getByRole('region', { name: 'Policy check' });

const trySample = async (user: User, label: RegExp) => {
  await user.click(await screen.findByRole('button', { name: label }));
  await screen.findByRole('form', { name: 'Expense review' });
};

const spentBy = (user: User, role = 'Employee') =>
  user.selectOptions(within(review()).getByLabelText('Spent by (employee role)'), role);

describe('ReceiptsPage', () => {
  it('reads a sample receipt, lets you review it, and runs the policy check', async () => {
    const { user } = await renderReceipts();
    await trySample(user, /Bakery breakfast/);

    const form = review();
    expect(within(form).getByLabelText(/Merchant/)).toHaveValue('Padaria Central Ltda');
    expect(within(form).getByLabelText(/Date/)).toHaveValue('2026-11-10');
    expect(within(form).getByLabelText(/Total/)).toHaveValue('86.40');
    expect(within(form).getByLabelText(/Category/)).toHaveValue('MEALS');
    expect(within(form).getByLabelText('The receipt is legible', { exact: false })).toBeChecked();
    expect(within(form).getAllByText('filled this in', { exact: false })).toHaveLength(4);
    expect(screen.getByText(/high confidence/)).toBeInTheDocument();
    expect(within(result()).getByText(/Fill in the total, category/)).toBeInTheDocument();

    await spentBy(user);

    expect(within(result()).getByText('Compliant')).toBeInTheDocument();
    expect(within(result()).getByText('Within the R$250.00 limit.')).toBeInTheDocument();
  });

  it('re-checks as you correct the fields', async () => {
    const { user } = await renderReceipts();
    await trySample(user, /Bakery breakfast/);
    await spentBy(user);

    const total = within(review()).getByLabelText(/Total/);
    await user.clear(total);
    await user.type(total, '300');

    expect(within(result()).getByText('Violation')).toBeInTheDocument();
    expect(within(result()).getByText('R$300.00 is above the R$250.00 limit.')).toBeInTheDocument();
  });

  it('flags a hotel stay over the employee limit', async () => {
    const { user } = await renderReceipts();
    await trySample(user, /Hotel stay/);
    await spentBy(user);

    expect(within(result()).getByText('Violation')).toBeInTheDocument();
    expect(
      within(result()).getByText('R$1,850.00 is above the R$1,000.00 limit.'),
    ).toBeInTheDocument();
  });

  it('asks for approval on a flight', async () => {
    const { user } = await renderReceipts();
    await trySample(user, /Flight/);
    await spentBy(user);

    expect(within(result()).getByText('Needs approval')).toBeInTheDocument();
    expect(within(result()).getByText('1 approval level')).toBeInTheDocument();
  });

  it('leaves legibility to the reviewer when the AI could not read the receipt', async () => {
    const { user } = await renderReceipts();
    await trySample(user, /Faded receipt/);

    expect(screen.getByText(/low confidence/)).toBeInTheDocument();
    expect(screen.getByText(/too faded to read/)).toBeInTheDocument();
    const legible = within(review()).getByLabelText('The receipt is legible', { exact: false });
    expect(legible).not.toBeChecked();

    await user.type(within(review()).getByLabelText(/Total/), '200');
    await user.selectOptions(within(review()).getByLabelText(/Category/), 'Meals');
    await spentBy(user);
    expect(
      within(result()).getByText(
        'A readable receipt is required above R$125.00, and this one could not be read.',
      ),
    ).toBeInTheDocument();

    // The reviewer, not the model, decides the receipt is fine after all.
    await user.click(legible);
    expect(within(result()).getByText('Compliant')).toBeInTheDocument();
  });

  it('checks an expense entered by hand, with no receipt', async () => {
    const { user } = await renderReceipts();
    await user.click(screen.getByRole('button', { name: 'No receipt: fill in manually' }));

    expect(screen.getByText(/No receipt attached/)).toBeInTheDocument();
    await user.type(within(review()).getByLabelText(/Total/), '200');
    await user.selectOptions(within(review()).getByLabelText(/Category/), 'Meals');
    await spentBy(user);

    expect(within(result()).getByText('Violation')).toBeInTheDocument();
    expect(
      within(result()).getByText('A readable receipt is required above R$125.00.'),
    ).toBeInTheDocument();
  });

  it('validates the amount with the currency decimals', async () => {
    const { user } = await renderReceipts();
    await user.click(screen.getByRole('button', { name: 'No receipt: fill in manually' }));

    const total = within(review()).getByLabelText(/Total/);
    await user.type(total, '12.345');
    await user.tab();

    expect(await within(review()).findByText('Use at most 2 decimals.')).toBeInTheDocument();
    expect(total).toHaveAttribute('aria-invalid', 'true');
  });

  it('says so honestly when demo mode cannot read an uploaded file', async () => {
    const { user } = await renderReceipts();

    await user.upload(
      screen.getByLabelText('Receipt image'),
      new File(['png'], 'my-lunch.png', { type: 'image/png' }),
    );

    expect(await screen.findByText(/Demo mode only reads the sample receipts/)).toBeInTheDocument();
    expect(within(review()).getByLabelText(/Total/)).toHaveValue('');
    expect(screen.getByRole('img', { name: 'Receipt preview: my-lunch.png' })).toBeInTheDocument();
  });

  it('keeps manual entry available when the AI service is down', async () => {
    server.use(
      http.post('*/v1/receipts/extract', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'AI provider unavailable',
            status: 503,
            detail: 'The AI provider is rate limiting requests.',
          },
          { status: 503 },
        ),
      ),
    );
    const { user } = await renderReceipts();
    await trySample(user, /Bakery breakfast/);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The AI service could not read the receipt: The AI provider is rate limiting requests.',
    );
    expect(within(review()).getByLabelText(/Total/)).toHaveValue('');
  });
});
