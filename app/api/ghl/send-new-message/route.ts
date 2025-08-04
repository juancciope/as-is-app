import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh';
import { VercelEnvUpdater } from '@/lib/vercel-env-updater';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, message, contactName } = body;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    // Check if Supabase is configured
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // For server-side operations, we'll need to get user from request headers or JWT
    // For now, we'll skip user validation since this is an SMS sending endpoint

    // Initialize GHL API
    const apiKey = process.env.GHL_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID;

    if (!apiKey || !locationId) {
      return NextResponse.json(
        { error: 'GHL API not configured' },
        { status: 500 }
      );
    }

    const ghl = new GoHighLevelAPIWithRefresh({
      apiKey,
      locationId,
      clientId: process.env.GHL_CLIENT_ID,
      clientSecret: process.env.GHL_CLIENT_SECRET,
      refreshToken: process.env.GHL_REFRESH_TOKEN,
      onTokenRefresh: async (newAccessToken, newRefreshToken) => {
        const vercelApiToken = process.env.VERCEL_API_TOKEN;
        const vercelProjectId = process.env.VERCEL_PROJECT_ID;
        const vercelTeamId = process.env.VERCEL_TEAM_ID;
        
        if (vercelApiToken && vercelProjectId) {
          try {
            const vercelUpdater = new VercelEnvUpdater(vercelApiToken, vercelProjectId, vercelTeamId);
            await vercelUpdater.updateGHLTokens(newAccessToken, newRefreshToken);
            console.log('✅ Automatically updated GHL tokens in Vercel');
          } catch (error) {
            console.error('❌ Failed to update Vercel env vars:', error);
          }
        }
      }
    });

    // Step 1: Create or update contact in GHL
    console.log('Creating contact in GHL...');
    let ghlContact;
    try {
      // First, try to find existing contact by phone
      const searchResult = await ghl.searchContacts(phoneNumber);
      
      if (searchResult.contacts && searchResult.contacts.length > 0) {
        // Contact exists, use the first match
        ghlContact = searchResult.contacts[0];
        console.log('Found existing GHL contact:', ghlContact.id);
      } else {
        // Create new contact in GHL
        const newContact = await ghl.createContact({
          firstName: contactName || 'Unknown',
          phone: phoneNumber,
          locationId
        });
        ghlContact = newContact.contact;
        console.log('Created new GHL contact:', ghlContact.id);
      }
    } catch (error) {
      console.error('Error creating/finding GHL contact:', error);
      return NextResponse.json(
        { error: 'Failed to create contact in GHL' },
        { status: 500 }
      );
    }

    // Step 2: Create or update contact in our database
    console.log('Saving contact to database...');
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('ghl_contact_id', ghlContact.id)
      .single();

    let dbContact;
    if (existingContact) {
      // Update existing contact
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .update({
          name_first: contactName || existingContact.name_first || 'Unknown',
          phones: [{ number: phoneNumber, type: 'mobile' }],
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContact.id)
        .select()
        .single();

      if (error) throw error;
      dbContact = data;
    } else {
      // Create new contact (without user_id since this is server-side)
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .insert({
          ghl_contact_id: ghlContact.id,
          name_first: contactName || 'Unknown',
          phones: [{ number: phoneNumber, type: 'mobile' }],
          contact_type: 'sms_outreach',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      dbContact = data;
    }

    // Step 3: Send SMS through GHL
    console.log('Sending SMS through GHL...');
    try {
      const messageResult = await ghl.sendMessage({
        type: 'SMS',
        contactId: ghlContact.id,
        message: message
      });

      console.log('SMS sent successfully:', messageResult);

      // Step 4: Auto-star the conversation in GHL so it appears in our inbox
      try {
        await ghl.starConversation(messageResult.conversationId);
        console.log('✅ Conversation starred in GHL automatically');
      } catch (starError) {
        console.error('❌ Failed to star conversation in GHL:', starError);
        // Don't fail the whole operation if starring fails
      }

      // Step 5: Create conversation record in our database (without user_id for server-side)
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          contact_id: dbContact.id,
          ghl_conversation_id: messageResult.conversationId,
          ghl_contact_id: ghlContact.id,
          contact_name: dbContact.name_first || 'Unknown',
          contact_email: ghlContact.email,
          contact_phone: phoneNumber,
          last_message_body: message,
          last_message_date: new Date().toISOString(),
          last_message_type: 'SMS',
          unread_count: 0,
          starred: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        // Don't fail the whole operation if conversation creation fails
      }

      return NextResponse.json({
        success: true,
        contact: dbContact,
        conversation: conversation,
        messageId: messageResult.messageId,
        conversationId: messageResult.conversationId
      });

    } catch (error) {
      console.error('Error sending SMS:', error);
      return NextResponse.json(
        { error: 'Failed to send SMS' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in send-new-message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}