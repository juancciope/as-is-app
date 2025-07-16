/**
 * Contact Validation Utilities
 * 
 * Provides validation and normalization functions for contact data
 * to ensure consistency across legacy and vNext schemas.
 */

import type { Contact, PropertyContact } from './supabase';

interface PhoneContact {
  number: string;
  label: string;
  verified: boolean;
  source: string;
}

interface EmailContact {
  email: string;
  label: string;
  verified: boolean;
  source: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface NormalizedContact {
  phones: PhoneContact[];
  emails: EmailContact[];
  name_first?: string;
  name_last?: string;
  entity_name?: string;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!phone || phone.trim() === '') {
    errors.push('Phone number cannot be empty');
    return { isValid: false, errors, warnings };
  }
  
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Check for US phone numbers (10 digits, optionally with country code)
  if (digitsOnly.length === 10) {
    // Valid US phone number
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // Valid US phone number with country code
  } else if (digitsOnly.length === 7) {
    warnings.push('Phone number appears to be missing area code');
  } else {
    errors.push('Invalid phone number format');
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings 
  };
}

/**
 * Validate email address format
 */
export function validateEmailAddress(email: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!email || email.trim() === '') {
    errors.push('Email address cannot be empty');
    return { isValid: false, errors, warnings };
  }
  
  // Basic email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email address format');
  }
  
  // Check for common typos
  const commonTypos = [
    { pattern: /@gmial\./i, suggestion: '@gmail.' },
    { pattern: /@yahooo\./i, suggestion: '@yahoo.' },
    { pattern: /@hotmial\./i, suggestion: '@hotmail.' },
    { pattern: /\.cmo$/i, suggestion: '.com' },
    { pattern: /\.con$/i, suggestion: '.com' }
  ];
  
  for (const typo of commonTypos) {
    if (typo.pattern.test(email)) {
      warnings.push(`Possible typo in email: did you mean ${email.replace(typo.pattern, typo.suggestion)}?`);
    }
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings 
  };
}

/**
 * Normalize phone number to consistent format
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle US phone numbers
  if (digitsOnly.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // Format as +1 (XXX) XXX-XXXX
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  } else if (digitsOnly.length === 7) {
    // Format as XXX-XXXX (missing area code)
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
  }
  
  // Return original if can't normalize
  return phone;
}

/**
 * Normalize email address to consistent format
 */
export function normalizeEmailAddress(email: string): string {
  if (!email) return '';
  
  // Convert to lowercase and trim
  return email.toLowerCase().trim();
}

/**
 * Validate complete contact record
 */
export function validateContact(contact: Contact): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate required fields
  if (!contact.id) {
    errors.push('Contact ID is required');
  }
  
  if (!contact.name_first && !contact.name_last && !contact.entity_name) {
    errors.push('Contact must have either personal name or entity name');
  }
  
  // Validate phone numbers
  if (contact.phones && Array.isArray(contact.phones)) {
    contact.phones.forEach((phone, index) => {
      const phoneValidation = validatePhoneNumber(phone.number);
      if (!phoneValidation.isValid) {
        errors.push(`Phone ${index + 1}: ${phoneValidation.errors.join(', ')}`);
      }
      if (phoneValidation.warnings.length > 0) {
        warnings.push(`Phone ${index + 1}: ${phoneValidation.warnings.join(', ')}`);
      }
    });
  }
  
  // Validate email addresses
  if (contact.emails && Array.isArray(contact.emails)) {
    contact.emails.forEach((email, index) => {
      const emailValidation = validateEmailAddress(email.email);
      if (!emailValidation.isValid) {
        errors.push(`Email ${index + 1}: ${emailValidation.errors.join(', ')}`);
      }
      if (emailValidation.warnings.length > 0) {
        warnings.push(`Email ${index + 1}: ${emailValidation.warnings.join(', ')}`);
      }
    });
  }
  
  // Validate contact type
  const validContactTypes = ['owner', 'attorney', 'trustee', 'servicer', 'skiptrace_result', 'manual_entry'];
  if (contact.contact_type && !validContactTypes.includes(contact.contact_type)) {
    errors.push(`Invalid contact type: ${contact.contact_type}`);
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings 
  };
}

/**
 * Normalize contact data from skip trace results
 */
export function normalizeSkipTraceContact(data: {
  emails?: string[];
  phones?: string[];
  parsedOwners?: Array<{ firstName: string; lastName: string }>;
}, source: string = 'skip_trace'): NormalizedContact[] {
  const contacts: NormalizedContact[] = [];
  
  if (!data.parsedOwners || data.parsedOwners.length === 0) {
    // Create single contact with all phone/email data
    const phones: PhoneContact[] = [];
    const emails: EmailContact[] = [];
    
    if (data.phones && Array.isArray(data.phones)) {
      data.phones.forEach((phone, index) => {
        const normalized = normalizePhoneNumber(phone);
        if (normalized) {
          phones.push({
            number: normalized,
            label: index === 0 ? 'primary' : 'secondary',
            verified: false,
            source
          });
        }
      });
    }
    
    if (data.emails && Array.isArray(data.emails)) {
      data.emails.forEach((email, index) => {
        const normalized = normalizeEmailAddress(email);
        if (normalized) {
          emails.push({
            email: normalized,
            label: index === 0 ? 'primary' : 'secondary',
            verified: false,
            source
          });
        }
      });
    }
    
    contacts.push({ phones, emails });
  } else {
    // Create separate contacts for each owner
    data.parsedOwners.forEach((owner, ownerIndex) => {
      const phones: PhoneContact[] = [];
      const emails: EmailContact[] = [];
      
      // Distribute phones and emails across owners
      if (data.phones && Array.isArray(data.phones)) {
        data.phones.forEach((phone, phoneIndex) => {
          // Simple distribution: first owner gets odd-indexed phones, second gets even-indexed
          if ((phoneIndex % 2) === (ownerIndex % 2)) {
            const normalized = normalizePhoneNumber(phone);
            if (normalized) {
              phones.push({
                number: normalized,
                label: phones.length === 0 ? 'primary' : 'secondary',
                verified: false,
                source
              });
            }
          }
        });
      }
      
      if (data.emails && Array.isArray(data.emails)) {
        data.emails.forEach((email, emailIndex) => {
          // Simple distribution: first owner gets odd-indexed emails, second gets even-indexed
          if ((emailIndex % 2) === (ownerIndex % 2)) {
            const normalized = normalizeEmailAddress(email);
            if (normalized) {
              emails.push({
                email: normalized,
                label: emails.length === 0 ? 'primary' : 'secondary',
                verified: false,
                source
              });
            }
          }
        });
      }
      
      contacts.push({
        phones,
        emails,
        name_first: owner.firstName || undefined,
        name_last: owner.lastName || undefined
      });
    });
  }
  
  return contacts;
}

/**
 * Deduplicate contacts by phone and email
 */
export function deduplicateContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  const deduplicated: Contact[] = [];
  
  for (const contact of contacts) {
    // Create a signature for this contact
    const phoneNumbers = contact.phones?.map(p => p.number.replace(/\D/g, '')).sort() || [];
    const emailAddresses = contact.emails?.map(e => e.email.toLowerCase()).sort() || [];
    
    const signature = JSON.stringify({
      phones: phoneNumbers,
      emails: emailAddresses,
      name: `${contact.name_first || ''} ${contact.name_last || ''}`.trim().toLowerCase(),
      entity: contact.entity_name?.toLowerCase() || ''
    });
    
    if (!seen.has(signature)) {
      seen.add(signature);
      deduplicated.push(contact);
    }
  }
  
  return deduplicated;
}

/**
 * Check if contact has valid contact information
 */
export function hasValidContactInfo(contact: Contact): boolean {
  const hasPhone = contact.phones && 
    contact.phones.length > 0 && 
    contact.phones.some(p => validatePhoneNumber(p.number).isValid);
  
  const hasEmail = contact.emails && 
    contact.emails.length > 0 && 
    contact.emails.some(e => validateEmailAddress(e.email).isValid);
  
  return hasPhone || hasEmail;
}

/**
 * Convert legacy contact columns to vNext format
 */
export function convertLegacyToVNextContact(legacyData: any): Contact | null {
  const phones: PhoneContact[] = [];
  const emails: EmailContact[] = [];
  
  // Extract phones
  for (let i = 1; i <= 5; i++) {
    const phone = legacyData[`owner_phone_${i}`];
    if (phone) {
      const normalized = normalizePhoneNumber(phone);
      if (normalized) {
        phones.push({
          number: normalized,
          label: i === 1 ? 'primary' : 'secondary',
          verified: false,
          source: 'legacy_migration'
        });
      }
    }
  }
  
  // Extract emails
  for (let i = 1; i <= 5; i++) {
    const email = legacyData[`owner_email_${i}`];
    if (email) {
      const normalized = normalizeEmailAddress(email);
      if (normalized) {
        emails.push({
          email: normalized,
          label: i === 1 ? 'primary' : 'secondary',
          verified: false,
          source: 'legacy_migration'
        });
      }
    }
  }
  
  // If no contact info, return null
  if (phones.length === 0 && emails.length === 0) {
    return null;
  }
  
  return {
    id: crypto.randomUUID(),
    name_first: legacyData.owner_1_first_name || undefined,
    name_last: legacyData.owner_1_last_name || undefined,
    entity_name: undefined,
    contact_type: 'skiptrace_result',
    phones,
    emails,
    mailing_address: undefined,
    notes: `Migrated from legacy system on ${new Date().toISOString()}`,
    created_at: legacyData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Validate property contact relationship
 */
export function validatePropertyContact(propertyContact: PropertyContact): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!propertyContact.property_id) {
    errors.push('Property ID is required');
  }
  
  if (!propertyContact.contact_id) {
    errors.push('Contact ID is required');
  }
  
  const validRoles = ['owner', 'attorney', 'trustee', 'servicer', 'skiptrace', 'manual'];
  if (!validRoles.includes(propertyContact.role)) {
    errors.push(`Invalid role: ${propertyContact.role}`);
  }
  
  if (propertyContact.confidence !== undefined && (propertyContact.confidence < 0 || propertyContact.confidence > 1)) {
    errors.push('Confidence must be between 0 and 1');
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings 
  };
}

export {
  type PhoneContact,
  type EmailContact,
  type ValidationResult,
  type NormalizedContact
};