import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Entreprise } from '../services/entreprise.service';

type InviteEnterpriseSelectProps = {
  id?: string;
  value: number | '';
  entreprises: Entreprise[];
  placeholder?: string;
  onSelect: (id: number) => void;
  onCreateNew: () => void;
};

const InviteEnterpriseSelect: React.FC<InviteEnterpriseSelectProps> = ({
  id = 'ent-invite-entreprise',
  value,
  entreprises,
  placeholder = 'Sélectionner une entreprise…',
  onSelect,
  onCreateNew,
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
    <div ref={rootRef} className={`platform-enterprise-select${open ? ' is-open' : ''}`}>
      <button
        type="button"
        id={id}
        className="platform-enterprise-select__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id}
      >
        <span className={selected ? undefined : 'platform-enterprise-select__placeholder'}>
          {selected?.nom ?? placeholder}
        </span>
        <ChevronDown size={16} className="platform-enterprise-select__chevron" aria-hidden />
      </button>
      {open && (
        <div className="platform-enterprise-select__panel" role="listbox" aria-labelledby={id}>
          {entreprises.map((ent) => {
            const isSelected = value === ent.id_entreprise;
            return (
              <button
                key={ent.id_entreprise}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`platform-enterprise-select__option${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  onSelect(ent.id_entreprise);
                  setOpen(false);
                }}
              >
                {ent.nom}
              </button>
            );
          })}
          <button
            type="button"
            role="option"
            className="platform-enterprise-select__option platform-enterprise-select__option--create"
            onClick={() => {
              onCreateNew();
              setOpen(false);
            }}
          >
            + Créer une nouvelle entreprise
          </button>
        </div>
      )}
    </div>
  );
};

export default InviteEnterpriseSelect;
