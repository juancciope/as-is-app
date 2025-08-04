'use client';

import { useState, useEffect } from 'react';
import { X, Phone, MessageSquare, User, Loader2, Search } from 'lucide-react';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (phoneNumber: string, message: string, contactName?: string) => Promise<void>;
  isLoading: boolean;
}

export function NewMessageModal({ isOpen, onClose, onSendMessage, isLoading }: NewMessageModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setPhoneNumber('');
      setContactName('');
      setMessage('');
      setError('');
    }
  }, [isOpen]);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length <= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setError('');
  };

  const getCleanPhoneNumber = () => {
    // Extract just the digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add +1 if it's a 10-digit number
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPhone = getCleanPhoneNumber();
    
    // Validate phone number
    if (!cleanPhone || cleanPhone.length < 11) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    // Validate message
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    try {
      await onSendMessage(cleanPhone, message.trim(), contactName.trim() || undefined);
      onClose();
    } catch (err) {
      setError('Failed to send message. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-[#04325E]" />
            New Message
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Phone Number Input */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline-block h-4 w-4 mr-1" />
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="(123) 456-7890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
              required
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Contact Name Input (Optional) */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline-block h-4 w-4 mr-1" />
              Contact Name (Optional)
            </label>
            <input
              id="name"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Message Input */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="inline-block h-4 w-4 mr-1" />
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
              rows={4}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length} characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !phoneNumber || !message.trim()}
              className="px-4 py-2 bg-[#04325E] text-white rounded-lg hover:bg-[#0a4976] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}