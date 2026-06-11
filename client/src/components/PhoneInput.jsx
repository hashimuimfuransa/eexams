import React, { useState } from 'react';

const COUNTRY_CODES = [
  { code: '+250', country: 'Rwanda', flag: '🇷🇼', example: '788 123 456' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸', example: '555 123 4567' },
  { code: '+44', country: 'UK', flag: '🇬🇧', example: '7700 900123' },
  { code: '+33', country: 'France', flag: '🇫🇷', example: '6 12 34 56 78' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', example: '151 12345678' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', example: '712 345 678' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬', example: '712 345 678' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿', example: '712 345 678' },
  { code: '+250', country: 'Burundi', flag: '🇧🇮', example: '712 345 678' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', example: '82 123 4567' },
  { code: '+86', country: 'China', flag: '🇨🇳', example: '138 1234 5678' },
  { code: '+91', country: 'India', flag: '🇮🇳', example: '98765 43210' },
];

function PhoneInput({ 
  value, 
  onChange, 
  error, 
  helper, 
  isDark = false,
  required = false,
  label = 'Phone number',
  id = 'phone',
  name = 'phone',
  autoFocus = false,
  onEmailDetected = null
}) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]); // Default to Rwanda
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Parse existing value to extract country code and phone number
  React.useEffect(() => {
    if (value) {
      const foundCountry = COUNTRY_CODES.find(c => value.startsWith(c.code));
      if (foundCountry) {
        setSelectedCountry(foundCountry);
        setPhoneNumber(value.substring(foundCountry.code.length).trim());
      } else {
        setPhoneNumber(value);
      }
    }
  }, [value]);

  const handleCountryChange = (country) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    // Update the full phone number with new country code
    const fullNumber = country.code + (phoneNumber ? ' ' + phoneNumber : '');
    onChange({ target: { name, value: fullNumber.trim() } });
  };

  const handlePhoneChange = (e) => {
    const newPhone = e.target.value;
    setPhoneNumber(newPhone);
    // Update the full phone number
    const fullNumber = selectedCountry.code + (newPhone ? ' ' + newPhone : '');
    onChange({ target: { name, value: fullNumber.trim() } });
    
    // Detect if user typed an email and notify parent
    if (onEmailDetected && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPhone)) {
      onEmailDetected(newPhone);
    }
  };

  const borderColor = error ? '#EF4444' : isDropdownOpen ? '#0D406C' : isDark ? '#1A5A8C' : '#D7E5DD';
  const bgColor = isDark ? '#082A45' : '#FFFFFF';
  const textColor = isDark ? '#E8F8F1' : '#0F172A';
  const helperColor = isDark ? '#9DC4D9' : '#475569';

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
        fontSize: 13, fontWeight: 500, color: helperColor,
      }}>
        <span>{label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}</span>
      </label>
      
      <div style={{
        position: 'relative',
        borderRadius: 2,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: isDropdownOpen && !error ? `0 0 0 3px rgba(13,64,108,0.08)` : error ? `0 0 0 3px rgba(239,68,68,0.08)` : 'none',
        display: 'flex',
        alignItems: 'center',
        height: 56,
      }}>
        {/* Country Code Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '13px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: textColor,
              fontFamily: "'DM Sans', sans-serif",
              borderRadius: '8px 0 0 8px',
            }}
          >
            <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
            <span>{selectedCountry.code}</span>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998,
                }}
                onClick={() => setIsDropdownOpen(false)}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 999,
                background: isDark ? '#082A45' : '#FFFFFF',
                border: `1px solid ${isDark ? '#1A5A8C' : '#D7E5DD'}`,
                borderRadius: 8,
                marginTop: 4,
                maxHeight: 300,
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: 200,
              }}>
                {COUNTRY_CODES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountryChange(country)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      fontSize: 14,
                      fontWeight: 500,
                      color: textColor,
                      fontFamily: "'DM Sans', sans-serif",
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(13,64,108,0.2)' : 'rgba(13,64,108,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{country.flag}</span>
                    <span>{country.code}</span>
                    <span style={{ color: helperColor, fontSize: 13 }}>{country.country}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div style={{
          width: '1px',
          height: 24,
          background: isDark ? '#1A5A8C' : '#D7E5DD',
          margin: '0 4px',
        }} />

        {/* Phone Input */}
        <input
          id={id}
          name={name}
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          autoFocus={autoFocus}
          placeholder={selectedCountry.example}
          style={{
            flex: 1,
            padding: '13px 12px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 500,
            color: textColor,
          }}
        />
      </div>

      {/* Helper/Example Text */}
      <div style={{ marginTop: 6, fontSize: 12, color: helperColor, fontWeight: 500 }}>
        {error || helper || (
          <span>
            Example: <span style={{ color: '#0CBD73', fontWeight: 600 }}>{selectedCountry.code} {selectedCountry.example}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default PhoneInput;
