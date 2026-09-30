import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

interface FloatingInputProps {
  id?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  isPassword?: boolean;
  className?: string;
  autoComplete?: string;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  icon,
  required = false,
  disabled = false,
  isPassword = false,
  className = '',
  autoComplete,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputId = id || `floating-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const isFloating = isFocused || (value !== undefined && value !== null && value.toString().length > 0);

  return (
    <div className={`relative mt-2 ${className}`}>
      <div
        className={`relative rounded-xl border transition-all duration-200 ease-out bg-white ${
          isFocused
            ? 'border-indigo-600 ring-2 ring-indigo-600/20'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''}`}
      >
        {/* Left Icon */}
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-10">
            {icon}
          </div>
        )}

        {/* Floating Label (Sits directly on top border line when active) */}
        <label
          htmlFor={inputId}
          className={`absolute pointer-events-none transition-all duration-200 ease-out z-20 select-none ${
            isFloating
              ? 'top-0 -translate-y-1/2 left-3.5 px-1 bg-white text-xs font-semibold text-indigo-600'
              : `top-1/2 -translate-y-1/2 text-sm text-slate-400 font-normal ${icon ? 'left-10' : 'left-3.5'}`
          } ${!isFocused && isFloating ? 'text-slate-600' : ''}`}
        >
          {label}
        </label>

        {/* Actual Input */}
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`w-full bg-transparent text-slate-900 text-sm py-3.5 focus:outline-none transition-all rounded-xl ${
            icon ? 'pl-10' : 'pl-3.5'
          } ${isPassword ? 'pr-11' : 'pr-3.5'}`}
        />

        {/* Password Show/Hide Toggle Button */}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition z-10"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
};
