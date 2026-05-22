import React from 'react';
import { FileText } from 'lucide-react';

/** Placeholder hub for Docs navigation (/docs). */
const Docs: React.FC = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
    <FileText size={40} className="text-[#87909e]" strokeWidth={1.5} />
    <h1 className="m-0 text-lg font-semibold text-[#292d34]">Docs</h1>
    <p className="m-0 max-w-md text-sm text-[#87909e]">
      Espace documentaire — à venir. Utilisez les espaces dans la barre latérale pour
      gérer projets et listes.
    </p>
  </div>
);

export default Docs;
