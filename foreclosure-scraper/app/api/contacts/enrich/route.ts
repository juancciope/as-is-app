/**
 * Contact Enrichment API Endpoint
 * 
 * This endpoint provides contact enrichment functionality for the vNext schema:
 * - Validate contact data before saving
 * - Normalize phone numbers and emails
 * - Deduplicate contacts
 * - Update contact information
 * - Manage property-contact relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FeatureFlags } from '@/lib/config';
import { 
  validateContact, 
  normalizePhoneNumber, 
  normalizeEmailAddress,
  deduplicateContacts,
  hasValidContactInfo,
  type ValidationResult 
} from '@/lib/contact-validation';
import type { Contact, PropertyContact } from '@/lib/supabase';

interface EnrichmentRequest {
  propertyId: string;
  contacts: Partial<Contact>[];
  deduplicateContacts?: boolean;
  updateExisting?: boolean;
}

interface EnrichmentResponse {
  success: boolean;
  message: string;
  data?: {
    contactsCreated: number;
    contactsUpdated: number;
    contactsSkipped: number;
    validationErrors: string[];
    validationWarnings: string[];
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Only available in vNext mode
    if (FeatureFlags.USE_LEGACY) {
      return NextResponse.json(
        { error: 'Contact enrichment is only available in vNext mode' },
        { status: 400 }
      );
    }

    const data: EnrichmentRequest = await request.json();
    const { propertyId, contacts, deduplicateContacts: shouldDeduplicate = true, updateExisting = false } = data;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: 'Contacts array is required' },
        { status: 400 }
      );
    }

    // Verify property exists
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const result = await enrichContacts(propertyId, contacts, shouldDeduplicate, updateExisting);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Contact enrichment error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Get existing contacts for property
    const { data: propertyContacts, error } = await supabaseAdmin
      .from('property_contacts')
      .select(`
        *,
        contacts (*)
      `)
      .eq('property_id', propertyId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      );
    }

    const contacts = propertyContacts?.map(pc => (pc as any).contacts).filter(Boolean) || [];

    return NextResponse.json({
      success: true,
      data: {
        contacts,
        summary: {
          totalContacts: contacts.length,
          contactsWithPhones: contacts.filter(c => c.phones && c.phones.length > 0).length,
          contactsWithEmails: contacts.filter(c => c.emails && c.emails.length > 0).length,
          validContacts: contacts.filter(c => hasValidContactInfo(c)).length
        }
      }
    });

  } catch (error) {
    console.error('Contact fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function enrichContacts(
  propertyId: string,
  contacts: Partial<Contact>[],
  shouldDeduplicate: boolean,
  updateExisting: boolean
): Promise<EnrichmentResponse> {
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];
  let contactsCreated = 0;
  let contactsUpdated = 0;
  let contactsSkipped = 0;

  try {
    // Normalize and validate contacts
    const normalizedContacts: Contact[] = [];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      // Ensure required fields
      const normalizedContact: Contact = {
        id: contact.id || crypto.randomUUID(),
        name_first: contact.name_first || null,
        name_last: contact.name_last || null,
        entity_name: contact.entity_name || null,
        contact_type: contact.contact_type || 'manual_entry',
        phones: contact.phones || [],
        emails: contact.emails || [],
        mailing_address: contact.mailing_address || null,
        notes: contact.notes || null,
        created_at: contact.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Normalize phone numbers
      if (normalizedContact.phones && normalizedContact.phones.length > 0) {
        normalizedContact.phones = normalizedContact.phones.map(phone => ({
          ...phone,
          number: normalizePhoneNumber(phone.number)
        }));
      }

      // Normalize email addresses
      if (normalizedContact.emails && normalizedContact.emails.length > 0) {
        normalizedContact.emails = normalizedContact.emails.map(email => ({
          ...email,
          email: normalizeEmailAddress(email.email)
        }));
      }

      // Validate contact
      const validation = validateContact(normalizedContact);
      if (!validation.isValid) {
        validationErrors.push(`Contact ${i + 1}: ${validation.errors.join(', ')}`);
        continue;
      }

      if (validation.warnings.length > 0) {
        validationWarnings.push(`Contact ${i + 1}: ${validation.warnings.join(', ')}`);
      }

      // Only add contacts with valid contact info
      if (hasValidContactInfo(normalizedContact)) {
        normalizedContacts.push(normalizedContact);
      } else {
        contactsSkipped++;
        validationWarnings.push(`Contact ${i + 1}: No valid phone or email information`);
      }
    }

    // Deduplicate if requested
    const finalContacts = shouldDeduplicate 
      ? deduplicateContacts(normalizedContacts)
      : normalizedContacts;

    // Check for existing contacts if updating
    let existingContacts: Contact[] = [];
    if (updateExisting) {
      const { data: existingData, error: existingError } = await supabaseAdmin!
        .from('property_contacts')
        .select(`
          contact_id,
          contacts (*)
        `)
        .eq('property_id', propertyId);

      if (existingError) {
        throw new Error(`Failed to fetch existing contacts: ${existingError.message}`);
      }

      existingContacts = existingData?.map(pc => (pc as any).contacts).filter(Boolean) || [];
    }

    // Process each contact
    for (const contact of finalContacts) {
      let contactId = contact.id;
      let isUpdate = false;

      // Check if contact already exists (by ID or by matching phone/email)
      if (updateExisting) {
        const existingContact = existingContacts.find(existing => 
          existing.id === contact.id || 
          (contact.phones && contact.phones.some(phone => 
            existing.phones?.some(existingPhone => 
              existingPhone.number.replace(/\D/g, '') === phone.number.replace(/\D/g, '')
            )
          )) ||
          (contact.emails && contact.emails.some(email => 
            existing.emails?.some(existingEmail => 
              existingEmail.email.toLowerCase() === email.email.toLowerCase()
            )
          ))
        );

        if (existingContact) {
          contactId = existingContact.id;
          isUpdate = true;
        }
      }

      if (isUpdate) {
        // Update existing contact
        const { error: updateError } = await supabaseAdmin!
          .from('contacts')
          .update({
            name_first: contact.name_first,
            name_last: contact.name_last,
            entity_name: contact.entity_name,
            contact_type: contact.contact_type,
            phones: contact.phones,
            emails: contact.emails,
            mailing_address: contact.mailing_address,
            notes: contact.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', contactId);

        if (updateError) {
          throw new Error(`Failed to update contact: ${updateError.message}`);
        }

        contactsUpdated++;
      } else {
        // Create new contact
        const { error: insertError } = await supabaseAdmin!
          .from('contacts')
          .insert({
            ...contact,
            id: contactId
          });

        if (insertError) {
          throw new Error(`Failed to create contact: ${insertError.message}`);
        }

        contactsCreated++;
      }

      // Ensure property-contact relationship exists
      const { error: relationshipError } = await supabaseAdmin!
        .from('property_contacts')
        .upsert({
          property_id: propertyId,
          contact_id: contactId,
          role: 'manual',
          confidence: 0.9,
          last_validated_at: new Date().toISOString()
        });

      if (relationshipError) {
        console.error('Failed to create property-contact relationship:', relationshipError);
      }
    }

    return {
      success: true,
      message: `Successfully processed ${finalContacts.length} contacts`,
      data: {
        contactsCreated,
        contactsUpdated,
        contactsSkipped,
        validationErrors,
        validationWarnings
      }
    };

  } catch (error) {
    console.error('Contact enrichment processing error:', error);
    return {
      success: false,
      message: 'Failed to process contacts',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        contactsCreated,
        contactsUpdated,
        contactsSkipped,
        validationErrors,
        validationWarnings
      }
    };
  }
}

export { POST, GET };