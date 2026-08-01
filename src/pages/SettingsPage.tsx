import React from 'react';
import { CompanyProfileForm } from '../components/CompanyProfileForm';
import { Company } from '../types';

interface SettingsPageProps {
  company: Company;
  onCompanyUpdated: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ company, onCompanyUpdated }) => {
  return (
    <div className="space-y-6">
      <CompanyProfileForm company={company} onCompanyUpdated={onCompanyUpdated} />
    </div>
  );
};
