import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CandidatePipelineStepper from './CandidatePipelineStepper';

describe('CandidatePipelineStepper', () => {
  it('renders all stage steps for an uploaded candidate', () => {
    render(<CandidatePipelineStepper currentStatus="Uploaded" />);

    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
    expect(screen.getByText('Interview')).toBeInTheDocument();
    expect(screen.getByText('Offer')).toBeInTheDocument();
    expect(screen.getByText('Hired')).toBeInTheDocument();
  });

  it('renders assessment stage as active when in Technical Assessment', () => {
    render(<CandidatePipelineStepper currentStatus="Technical Assessment" />);

    const assessmentStep = screen.getByText('Assessment').closest('li');
    expect(assessmentStep).toHaveClass('text-primary');
  });

  it('renders interview stage as active when in Interview Scheduled', () => {
    render(<CandidatePipelineStepper currentStatus="Interview Scheduled" />);

    const interviewStep = screen.getByText('Interview').closest('li');
    expect(interviewStep).toHaveClass('text-primary');
  });

  it('handles rejected candidates gracefully', () => {
    render(<CandidatePipelineStepper currentStatus="Reject" />);

    expect(screen.getByText('Rejected / Closed')).toBeInTheDocument();
  });
});
