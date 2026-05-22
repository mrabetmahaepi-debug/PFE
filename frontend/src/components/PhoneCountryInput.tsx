import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Smartphone } from 'lucide-react';
import {
  DEFAULT_PHONE_COUNTRY_ISO,
  digitsOnly,
  filterCountries,
  getCountryByIso,
  type PhoneCountryConfig,
} from '../lib/phoneCountries';
import './PhoneCountryInput.css';

export type PhoneCountryValue = {
  countryIso: string;
  phoneCountryCode: string;
  phoneNumber: string;
  display: string;
};

type PhoneCountryInputProps = {
  value: PhoneCountryValue;
  onChange: (value: PhoneCountryValue) => void;
  error?: string;
  disabled?: boolean;
};

function buildValue(
  country: PhoneCountryConfig,
  rawDigits: string
): PhoneCountryValue {
  const phoneNumber = digitsOnly(rawDigits).slice(0, country.maxDigits);
  return {
    countryIso: country.iso,
    phoneCountryCode: country.dialCode,
    phoneNumber,
    display: country.format(phoneNumber),
  };
}

export function createDefaultPhoneValue(): PhoneCountryValue {
  const country = getCountryByIso(DEFAULT_PHONE_COUNTRY_ISO);
  return {
    countryIso: country.iso,
    phoneCountryCode: country.dialCode,
    phoneNumber: '',
    display: '',
  };
}

const PhoneCountryInput: React.FC<PhoneCountryInputProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const fieldId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [shellFocused, setShellFocused] = useState(false);

  const country = useMemo(
    () => getCountryByIso(value.countryIso || DEFAULT_PHONE_COUNTRY_ISO),
    [value.countryIso]
  );

  const filteredCountries = useMemo(() => filterCountries(search), [search]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setSearch('');
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (shellRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (menuOpen) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [menuOpen]);

  const selectCountry = (next: PhoneCountryConfig) => {
    onChange(buildValue(next, value.phoneNumber));
    closeMenu();
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(buildValue(country, e.target.value));
  };

  const shellClass = [
    'phone-container',
    shellFocused || menuOpen ? 'phone-container--focused' : '',
    error ? 'phone-container--error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`phone-country-field${menuOpen ? ' phone-country-field--open' : ''}`}>
      <div
        ref={shellRef}
        className={shellClass}
        onFocusCapture={() => setShellFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setShellFocused(false);
          }
        }}
      >
        <Smartphone className="phone-container__icon" size={18} aria-hidden />

        <div className="phone-country-picker">
          <button
            ref={triggerRef}
            type="button"
            className="phone-country-trigger"
            onClick={() => {
              if (disabled) return;
              setMenuOpen((open) => !open);
            }}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label={`Pays : ${country.name}, ${country.dialCode}`}
          >
            <span className="phone-country-trigger__label">
              {country.iso} {country.dialCode}
            </span>
            <ChevronDown
              size={15}
              className={`phone-country-trigger__chevron${menuOpen ? ' phone-country-trigger__chevron--open' : ''}`}
              aria-hidden
            />
          </button>
        </div>

        <span className="phone-container__divider" aria-hidden />

        <div
          className="phone-number-wrap"
          onMouseDown={(e) => {
            if (disabled) return;
            if (e.target === e.currentTarget) {
              e.preventDefault();
              numberInputRef.current?.focus();
            }
          }}
        >
          <input
            ref={numberInputRef}
            id={fieldId}
            type="tel"
            inputMode="numeric"
            className="phone-number-input"
            value={value.display}
            onChange={handleNumberChange}
            placeholder={country.placeholder}
            disabled={disabled}
            autoComplete="tel-national"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${fieldId}-err` : undefined}
          />
        </div>
      </div>

      {menuOpen ? (
        <div
          ref={menuRef}
          className="phone-country-menu"
          role="listbox"
          aria-label="Choisir un pays"
        >
          <div className="phone-country-search-wrap">
            <input
              ref={searchRef}
              type="search"
              className="phone-country-search"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Rechercher un pays"
            />
          </div>
          <ul className="phone-country-list">
            {filteredCountries.length === 0 ? (
              <li className="phone-country-empty">Aucun pays trouvé</li>
            ) : (
              filteredCountries.map((c) => (
                <li key={c.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.iso === country.iso}
                    className={[
                      'phone-country-option',
                      c.iso === country.iso ? 'phone-country-option--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectCountry(c)}
                  >
                    <span className="phone-country-option__label">
                      {c.iso} {c.name}
                    </span>
                    <span className="phone-country-option__dial">{c.dialCode}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p id={`${fieldId}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PhoneCountryInput;
