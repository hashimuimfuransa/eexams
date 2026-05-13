import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SecurityMonitoring from '../components/admin/security/SecurityMonitoring';
import { getSecurityAlerts, resolveSecurityAlert, ignoreSecurityAlert } from '../services/adminService';

// Mock the adminService
jest.mock('../services/adminService', () => ({
  getSecurityAlerts: jest.fn(),
  resolveSecurityAlert: jest.fn(),
  ignoreSecurityAlert: jest.fn()
}));

// Mock data
const mockAlerts = [
  {
    _id: '1',
    type: 'multiple_device',
    student: {
      _id: '101',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      class: 'Grade 10',
      organization: 'Example School'
    },
    description: 'Multiple device login detected',
    timestamp: new Date().toISOString(),
    status: 'unresolved'
  },
  {
    _id: '2',
    type: 'browser_switch',
    student: {
      _id: '102',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      class: 'Grade 11',
      organization: 'Example School'
    },
    description: 'Browser tab switching detected',
    timestamp: new Date().toISOString(),
    status: 'resolved'
  }
];

describe('SecurityMonitoring Component', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the API calls
    getSecurityAlerts.mockResolvedValue(mockAlerts);
    resolveSecurityAlert.mockResolvedValue({});
    ignoreSecurityAlert.mockResolvedValue({});
  });

  test('renders the component with loading state', () => {
    render(<SecurityMonitoring />);
    
    // Check for loading indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Check for title
    expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
  });

  test('displays security alerts after loading', async () => {
    render(<SecurityMonitoring />);
    
    // Wait for alerts to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if alerts are displayed
    expect(screen.getByText('Multiple Device')).toBeInTheDocument();
    expect(screen.getByText('Browser Switch')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('filters alerts based on tab selection', async () => {
    render(<SecurityMonitoring />);
    
    // Wait for alerts to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click on Resolved tab
    fireEvent.click(screen.getByText('Resolved'));
    
    // Check if only resolved alerts are shown
    expect(screen.queryByText('Multiple Device')).not.toBeInTheDocument();
    expect(screen.getByText('Browser Switch')).toBeInTheDocument();
    
    // Click on Unresolved tab
    fireEvent.click(screen.getByText('Unresolved'));
    
    // Check if only unresolved alerts are shown
    expect(screen.getByText('Multiple Device')).toBeInTheDocument();
    expect(screen.queryByText('Browser Switch')).not.toBeInTheDocument();
  });

  test('opens resolve dialog when resolve button is clicked', async () => {
    render(<SecurityMonitoring />);
    
    // Wait for alerts to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Find and click the resolve button (using title attribute)
    const resolveButton = screen.getByTitle('Resolve');
    fireEvent.click(resolveButton);
    
    // Check if dialog is open
    expect(screen.getByText('Resolve Alert')).toBeInTheDocument();
    expect(screen.getByText('Add notes about how this security issue was resolved.')).toBeInTheDocument();
  });

  test('resolves an alert when resolve is confirmed', async () => {
    render(<SecurityMonitoring />);
    
    // Wait for alerts to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Find and click the resolve button
    const resolveButton = screen.getByTitle('Resolve');
    fireEvent.click(resolveButton);
    
    // Enter notes
    const notesField = screen.getByLabelText('Notes');
    fireEvent.change(notesField, { target: { value: 'Issue has been resolved' } });
    
    // Click resolve button in dialog
    fireEvent.click(screen.getByText('Resolve'));
    
    // Check if resolveSecurityAlert was called
    await waitFor(() => {
      expect(resolveSecurityAlert).toHaveBeenCalledWith('1', { notes: 'Issue has been resolved' });
    });
    
    // Check if success message is shown
    await waitFor(() => {
      expect(screen.getByText('Alert resolved successfully')).toBeInTheDocument();
    });
  });

  test('ignores an alert when ignore is confirmed', async () => {
    render(<SecurityMonitoring />);
    
    // Wait for alerts to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Find and click the ignore button
    const ignoreButton = screen.getByTitle('Ignore');
    fireEvent.click(ignoreButton);
    
    // Enter notes
    const notesField = screen.getByLabelText('Notes');
    fireEvent.change(notesField, { target: { value: 'False positive' } });
    
    // Click ignore button in dialog
    fireEvent.click(screen.getByText('Ignore'));
    
    // Check if ignoreSecurityAlert was called
    await waitFor(() => {
      expect(ignoreSecurityAlert).toHaveBeenCalledWith('1', { notes: 'False positive' });
    });
    
    // Check if success message is shown
    await waitFor(() => {
      expect(screen.getByText('Alert ignored successfully')).toBeInTheDocument();
    });
  });

  test('refreshes data when refresh button is clicked', async () => {
    render(<SecurityMonitoring />);
    
    // Wait for alerts to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Clear the mock to check if it's called again
    getSecurityAlerts.mockClear();
    
    // Click refresh button
    fireEvent.click(screen.getByText('Refresh'));
    
    // Check if getSecurityAlerts was called again
    expect(getSecurityAlerts).toHaveBeenCalled();
  });

  test('handles API error gracefully', async () => {
    // Mock API error
    getSecurityAlerts.mockRejectedValueOnce(new Error('Failed to fetch'));
    
    render(<SecurityMonitoring />);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Failed to load security alerts')).toBeInTheDocument();
    });
  });
});
