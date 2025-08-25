import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Get all contact lists ordered by creation date
    const { data: contactLists, error: listsError } = await supabase
      .from("contact_list")
      .select(`
        id,
        name,
        description,
        created_at,
        contact_list_member (
          id
        )
      `)
      .order("created_at", { ascending: false });

    if (listsError) {
      throw new Error(`Failed to fetch contact lists: ${listsError.message}`);
    }

    // Transform data to include contact count
    const listsWithCounts = (contactLists || []).map(list => ({
      id: list.id,
      name: list.name,
      description: list.description,
      created_at: list.created_at,
      contact_count: list.contact_list_member?.length || 0
    }));

    return Response.json({
      success: true,
      contactLists: listsWithCounts
    });

  } catch (error) {
    console.error("API Error:", error);

    return Response.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Create a new contact list
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return Response.json(
        {
          success: false,
          error: "Contact list name is required",
        },
        { status: 400 }
      );
    }

    // Create new contact list
    const { data: newList, error: createError } = await supabase
      .from("contact_list")
      .insert([{
        name: name.trim(),
        description: description?.trim() || null
      }])
      .select("id, name, description, created_at")
      .single();

    if (createError) {
      throw new Error(`Failed to create contact list: ${createError.message}`);
    }

    return Response.json({
      success: true,
      contactList: {
        ...newList,
        contact_count: 0
      }
    });

  } catch (error) {
    console.error("API Error:", error);

    return Response.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}