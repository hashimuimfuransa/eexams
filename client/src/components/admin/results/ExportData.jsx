import React from 'react';
import PlaceholderComponent from '../shared/PlaceholderComponent.jsx';

const ExportData = () => {
  return (
    <PlaceholderComponent
      title="Export Data"
      description="Export exam results and analytics to various formats"
      returnPath="/admin/results"
      returnText="Back to Results"
    />
  );
};

export default ExportData;
