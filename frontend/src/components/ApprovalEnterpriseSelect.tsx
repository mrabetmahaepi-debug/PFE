import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Entreprise } from '../services/entreprise.service';

type ApprovalEnterpriseSelectProps = {
  value: number | '';
  onChange: (id: number) => void;
  entreprises: Entreprise[];
  placeholder?: string;
};

const ApprovalEnterpriseSelect: React.FC<ApprovalEnterpriseSelectProps> = ({
  value,
  onChange,
  entreprises,
  placeholder = 'Sélectionner une entreprise...',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selected = entreprises.find((e) => e.id_entreprise === value);

  return (
    <div ref={rootRef} className={`approval-enterprise-select${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="approval-enterprise-select__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? undefined : 'approval-enterprise-select__placeholder'}>
          {selected?.nom ?? placeholder}
        </span>
        <ChevronDown size={18} className="approval-enterprise-select__chevron" aria-hidden />
      </button>
      {open && (
        <div className="approval-enterprise-select__panel" role="listbox">
          {entreprises.map((ent) => {
            const isSelected = value === ent.id_entreprise;
            return (
              <button
                key={ent.id_entreprise}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`approval-enterprise-select__option${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(ent.id_entreprise);
                  setOpen(false);
                }}
              >
                {ent.nom}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApprovalEnterpriseSelect;
