/**
 * Tests for the Header component.
 */

import { render, screen } from '@testing-library/react';
import Header from '../Header';

describe('Header', () => {
  it('renders the WINDMAR logo and title', () => {
    render(<Header />);

    expect(screen.getByText('WINDMAR')).toBeInTheDocument();
    expect(screen.getByText('Maritime Route Optimizer')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: /routes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fuel analysis/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vessel config/i })).toBeInTheDocument();
  });

  it('displays correct href for navigation links', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: /routes/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /fuel analysis/i })).toHaveAttribute('href', '/fuel-analysis');
    expect(screen.getByRole('link', { name: /vessel config/i })).toHaveAttribute('href', '/vessel-config');
  });

  it('displays system status indicator', () => {
    render(<Header />);

    expect(screen.getByText('System Online')).toBeInTheDocument();
  });

  it('renders logo link pointing to home', () => {
    render(<Header />);

    // The logo link should point to home
    const logoLink = screen.getByRole('link', { name: /windmar/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });
});
