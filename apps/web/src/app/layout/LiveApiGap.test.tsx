import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveApiGap } from './LiveApiGap';

describe('LiveApiGap', () => {
  it('renders the page untouched in mock mode', () => {
    render(
      <LiveApiGap feature="Expense categories" live={false}>
        <p>the page</p>
      </LiveApiGap>,
    );
    expect(screen.getByText('the page')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('replaces a page the live API does not serve with a notice', () => {
    render(
      <LiveApiGap feature="Expense categories" live>
        <p>the page</p>
      </LiveApiGap>,
    );
    expect(screen.getByRole('heading', { name: 'Expense categories' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/not implemented in the live API yet/i);
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  it('keeps a partially served page and explains what is missing', () => {
    render(
      <LiveApiGap feature="New tenant" partial="Only the tenant is created." live>
        <p>the page</p>
      </LiveApiGap>,
    );
    expect(screen.getByText('the page')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Only the tenant is created.');
  });
});
