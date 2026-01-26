/**
 * Tests for the Card and StatCard components.
 */

import { render, screen } from '@testing-library/react';
import Card, { StatCard } from '../Card';

describe('Card', () => {
  it('renders children content', () => {
    render(
      <Card>
        <p>Test content</p>
      </Card>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Card title="Test Title">
        <p>Content</p>
      </Card>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <Card subtitle="Test Subtitle">
        <p>Content</p>
      </Card>
    );

    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('renders title and subtitle together', () => {
    render(
      <Card title="Main Title" subtitle="Sub Title">
        <p>Content</p>
      </Card>
    );

    expect(screen.getByText('Main Title')).toBeInTheDocument();
    expect(screen.getByText('Sub Title')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <Card icon={<span data-testid="test-icon">Icon</span>}>
        <p>Content</p>
      </Card>
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Card className="custom-class">
        <p>Content</p>
      </Card>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not render header section when no title/subtitle/icon', () => {
    render(
      <Card>
        <p data-testid="content">Content only</p>
      </Card>
    );

    // Should only have the content, not a header div
    const content = screen.getByTestId('content');
    expect(content.parentElement?.children).toHaveLength(1);
  });
});

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Distance" value={100} />);

    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders unit when provided', () => {
    render(<StatCard label="Distance" value={100} unit="nm" />);

    expect(screen.getByText('nm')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatCard
        label="Speed"
        value={14.5}
        icon={<span data-testid="speed-icon">S</span>}
      />
    );

    expect(screen.getByTestId('speed-icon')).toBeInTheDocument();
  });

  it('accepts string value', () => {
    render(<StatCard label="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with up trend', () => {
    const { container } = render(
      <StatCard
        label="Fuel"
        value={50}
        trend="up"
        icon={<span>↑</span>}
      />
    );

    // Trend up should have green color class
    const iconWrapper = container.querySelector('.text-green-400');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('renders with down trend', () => {
    const { container } = render(
      <StatCard
        label="Fuel"
        value={50}
        trend="down"
        icon={<span>↓</span>}
      />
    );

    // Trend down should have red color class
    const iconWrapper = container.querySelector('.text-red-400');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('renders with neutral trend', () => {
    const { container } = render(
      <StatCard
        label="Fuel"
        value={50}
        trend="neutral"
        icon={<span>–</span>}
      />
    );

    // Trend neutral should have gray color class
    const iconWrapper = container.querySelector('.text-gray-400');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatCard label="Test" value={1} className="my-custom-class" />
    );

    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
