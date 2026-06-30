import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, AlertCircle, X, Search, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/auth';

const inputCls =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400';

const readOnlyCls =
  'w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-lg text-sm text-secondary font-semibold cursor-not-allowed select-none';

export const IfscBankDetails = ({
  value = {},
  onChange,
  onValidityChange,
  disabled = false,
  showAccountName = false,
  accountNameValue = '',
  onAccountNameChange,
}) => {
  const { API } = useAuth();

  const [ifscInput, setIfscInput] = useState(value.ifsc || '');
  const [confirmAccountNo, setConfirmAccountNo] = useState(value.confirmAccountNo || value.accountNo || '');
  const [isValidating, setIsValidating] = useState(false);
  const [ifscError, setIfscError] = useState('');
  const [ifscSuccess, setIfscSuccess] = useState(!!value.bankName);

  const debounceTimerRef = useRef(null);

  // Helper to validate IFSC format locally
  const checkLocalIfscFormat = (code) => {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(code.trim().toUpperCase());
  };

  // Helper to validate Account Number locally
  const checkLocalAccountNoFormat = (num) => {
    return /^[0-9]{9,18}$/.test(num);
  };

  const handleValidateIFSC = useCallback(async (codeToValidate) => {
    const code = (codeToValidate || '').trim().toUpperCase();
    if (!code) {
      setIfscError('IFSC code cannot be empty');
      setIfscSuccess(false);
      return;
    }

    if (!checkLocalIfscFormat(code)) {
      setIfscError('Invalid IFSC format. Example: SBIN0001234');
      setIfscSuccess(false);
      return;
    }

    setIsValidating(true);
    setIfscError('');
    try {
      const response = await axios.get(`${API}/system-setting/validate-ifsc/${code}`);
      if (response.data?.success) {
        const details = response.data.data;
        setIfscSuccess(true);
        setIfscError('');

        // Populate fields to parent
        onChange({
          ...value,
          ifsc: code,
          bankName: details.bank ? `${details.bank}${details.branch ? ' - ' + details.branch : ''}` : '',
          district: details.district,
          city: details.city,
          address: details.address,
        });
      } else {
        throw new Error(response.data?.message || 'Validation failed');
      }
    } catch (err) {
      setIfscSuccess(false);
      setIfscError(err.response?.data?.message || err.message || 'Failed to fetch IFSC details');

      // Clear fields in parent on failure to avoid stale details
      onChange({
        ...value,
        ifsc: code,
        bankName: '',
        branch: '',
        district: '',
        city: '',
        address: '',
      });
    } finally {
      setIsValidating(false);
    }
  }, [API, onChange, value]);

  // Debounced auto lookup while typing
  useEffect(() => {
    const code = ifscInput.trim().toUpperCase();
    if (code === (value.ifsc || '')) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (checkLocalIfscFormat(code)) {
      setIsValidating(true); // Immediate visual loading feed
      debounceTimerRef.current = setTimeout(() => {
        handleValidateIFSC(code);
      }, 600);
    } else {
      setIsValidating(false);
      setIfscSuccess(false);
      if (code.length >= 11) {
        setIfscError('Invalid IFSC format. Expected format: ABCD0123456');
      } else {
        setIfscError('');
      }
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [ifscInput, handleValidateIFSC, value.ifsc]);

  // Sync internal IFSC input state when external value changes
  useEffect(() => {
    if (value.ifsc !== undefined && value.ifsc !== ifscInput) {
      setIfscInput(value.ifsc);
      if (value.bankName) {
        setIfscSuccess(true);
        setIfscError('');
      }
    }
  }, [value.ifsc, value.bankName]);

  // Handle local validation updates to the parent form (so they can enable/disable submit button)
  useEffect(() => {
    const isIfscValid = ifscSuccess && !ifscError && !!value.bankName;
    const isAccValid = checkLocalAccountNoFormat(value.accountNo || '') && (value.accountNo === confirmAccountNo);
    const isAccHolderValid = !showAccountName || !!accountNameValue.trim();

    onValidityChange?.(isIfscValid && isAccValid && isAccHolderValid);
  }, [ifscSuccess, ifscError, value.bankName, value.accountNo, confirmAccountNo, showAccountName, accountNameValue, onValidityChange]);

  const handleClear = () => {
    setIfscInput('');
    setIfscSuccess(false);
    setIfscError('');
    onChange({
      ...value,
      ifsc: '',
      bankName: '',
      branch: '',
      district: '',
      state: '',
      city: '',
      address: '',
    });
  };

  return (
    <div className="space-y-4">
      {/* ─── IFSC Lookup Row ─── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
          IFSC Code *
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={ifscInput}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 11);
                setIfscInput(val);
              }}
              placeholder="e.g. SBIN0001234"
              disabled={disabled || isValidating}
              className={`${inputCls} uppercase pr-8`}
            />
            {isValidating && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-primary animate-pulse" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleValidateIFSC(ifscInput)}
            disabled={disabled || isValidating || ifscInput.length < 11}
            className="px-4 py-2 bg-primary text-background rounded-lg text-xs font-bold hover:bg-primary/95 disabled:opacity-50 transition-all"
          >
            Validate
          </button>

          {ifscSuccess && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-all"
              title="Clear IFSC"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Loading state indicator */}
        {isValidating && (
          <p className="text-[10px] text-primary font-semibold flex items-center gap-1 mt-0.5">
            Searching...
          </p>
        )}

        {/* Error Feedback */}
        {ifscError && (
          <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3" /> {ifscError}
          </p>
        )}

        {/* Success verified badge */}
        {ifscSuccess && value.bankName && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg border border-green-200/50 mt-1">
            <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-[10px] font-bold">
              Verified: {value.bankName}
            </span>
          </div>
        )}
      </div>

      {/* ─── Auto-populated Read-Only Branch Details ─── */}
      {ifscSuccess && value.bankName && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-gray-50/50 rounded-xl border border-gray-150 animate-in fade-in duration-200">
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Bank Name & Branch</label>
            <div className={readOnlyCls}>{value.bankName}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">District</label>
            <div className={readOnlyCls}>{value.district || 'N/A'}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">City</label>
            <div className={readOnlyCls}>
              {value.city || 'N/A'}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Branch Address</label>
            <div className={`${readOnlyCls} whitespace-normal text-xs`}>{value.address || 'N/A'}</div>
          </div>
        </div>
      )}

      {/* ─── Optional Account Holder's Name ─── */}
      {showAccountName && onAccountNameChange && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
            Account Holder's Name *
          </label>
          <input
            type="text"
            value={accountNameValue}
            onChange={(e) => onAccountNameChange(e.target.value)}
            disabled={disabled}
            placeholder="As per bank passbook"
            className={inputCls}
          />
        </div>
      )}

      {/* ─── Account Numbers Row ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
            Account Number *
          </label>
          <input
            type="text"
            value={value.accountNo || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 18);
              onChange({ ...value, accountNo: val });
            }}
            disabled={disabled}
            placeholder="Enter account number"
            className={inputCls}
          />
          {value.accountNo && !checkLocalAccountNoFormat(value.accountNo) && (
            <span className="text-[9px] text-red-500 font-bold mt-0.5">
              Must be 9 to 18 numeric digits
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
            Confirm Account Number *
          </label>
          <input
            type="text"
            value={confirmAccountNo}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 18);
              setConfirmAccountNo(val);
            }}
            disabled={disabled}
            placeholder="Re-enter account number"
            className={inputCls}
          />
          {confirmAccountNo && value.accountNo !== confirmAccountNo && (
            <span className="text-[9px] text-red-500 font-bold mt-0.5">
              Account numbers do not match
            </span>
          )}
          {confirmAccountNo && value.accountNo === confirmAccountNo && checkLocalAccountNoFormat(value.accountNo) && (
            <span className="text-[9px] text-green-600 font-bold mt-0.5 flex items-center gap-0.5">
              <CheckCircle className="w-2.5 h-2.5" /> Account numbers matched
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
