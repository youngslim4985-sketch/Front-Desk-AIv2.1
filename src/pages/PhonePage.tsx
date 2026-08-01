import React from 'react';
import { PhoneSetup } from '../components/PhoneSetup';
import { PhoneConfig } from '../types';

interface PhonePageProps {
  companyId: string;
  phoneConfig: PhoneConfig;
  onConfigUpdated: () => void;
  onOpenTestCall: () => void;
}

export const PhonePage: React.FC<PhonePageProps> = ({
  companyId,
  phoneConfig,
  onConfigUpdated,
  onOpenTestCall,
}) => {
  return (
    <div className="space-y-6">
      <PhoneSetup
        companyId={companyId}
        phoneConfig={phoneConfig}
        onConfigUpdated={onConfigUpdated}
        onOpenTestCall={onOpenTestCall}
      />
    </div>
  );
};
