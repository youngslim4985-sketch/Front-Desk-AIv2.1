import React from 'react';
import { PDFUploader } from '../components/PDFUploader';
import { KnowledgeDocument } from '../types';

interface KnowledgeBasePageProps {
  companyId: string;
  documents: KnowledgeDocument[];
  onDocumentsUpdated: () => void;
}

export const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({
  companyId,
  documents,
  onDocumentsUpdated,
}) => {
  return (
    <div className="space-y-6">
      <PDFUploader
        companyId={companyId}
        documents={documents}
        onDocumentsUpdated={onDocumentsUpdated}
      />
    </div>
  );
};
