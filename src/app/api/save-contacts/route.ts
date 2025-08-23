import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface ContactToSave {
  first_name: string;
  last_name: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
  scraped_company_id: string;
  emails: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contacts }: { contacts: ContactToSave[] } = await req.json();

    if (!contacts || !Array.isArray(contacts)) {
      return Response.json({ error: "Invalid contacts data" }, { status: 400 });
    }

    if (contacts.length === 0) {
      return Response.json({ error: "No contacts to save" }, { status: 400 });
    }

    let savedContactsCount = 0;
    let savedEmailsCount = 0;
    const errors: string[] = [];

    // Process each contact
    for (const contactData of contacts) {
      try {
        // Check if contact already exists for this user
        const { data: existingContact } = await supabase
          .from('contact')
          .select('id')
          .eq('first_name', contactData.first_name)
          .eq('last_name', contactData.last_name || '')
          .eq('scraped_company_id', contactData.scraped_company_id)
          .single();

        let contactId: string;

        if (existingContact) {
          // Use existing contact
          contactId = existingContact.id;
        } else {
          // Create new contact
          const { data: newContact, error: contactError } = await supabase
            .from('contact')
            .insert({
              first_name: contactData.first_name,
              last_name: contactData.last_name,
              linkedin_url: contactData.linkedin_url,
              bio: contactData.bio,
              scraped_company_id: contactData.scraped_company_id,
            })
            .select('id')
            .single();

          if (contactError || !newContact) {
            errors.push(`Failed to save contact: ${contactData.first_name} ${contactData.last_name}`);
            continue;
          }

          contactId = newContact.id;
          savedContactsCount++;
        }

        // Save emails for this contact
        for (const email of contactData.emails) {
          // Check if email already exists for this contact
          const { data: existingEmail } = await supabase
            .from('contact_email')
            .select('id')
            .eq('contact_id', contactId)
            .eq('email', email)
            .single();

          if (!existingEmail) {
            const { error: emailError } = await supabase
              .from('contact_email')
              .insert({
                contact_id: contactId,
                email: email,
                confidence: 'pattern_generated',
                is_deliverable: null,
                validation_status: 'pending'
              });

            if (!emailError) {
              savedEmailsCount++;
            } else {
              errors.push(`Failed to save email: ${email} for ${contactData.first_name} ${contactData.last_name}`);
            }
          }
        }

      } catch (contactError) {
        console.error(`Error processing contact ${contactData.first_name} ${contactData.last_name}:`, contactError);
        errors.push(`Error processing contact: ${contactData.first_name} ${contactData.last_name}`);
      }
    }

    return Response.json({
      success: true,
      message: `Successfully saved ${savedContactsCount} contacts and ${savedEmailsCount} emails`,
      savedContactsCount,
      savedEmailsCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error in save-contacts API:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}