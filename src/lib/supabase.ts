import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database entities
// Company table unified - all company data stored here

export interface Company {
  id: string
  name: string
  address?: string
  website: string // Required for scraped companies
  normalized_domain: string // Normalized domain for deduplication (unique identifier)
  phone_number?: string
  reviews_count?: number
  reviews_average?: number
  store_shopping?: string
  in_store_pickup?: string
  store_delivery?: string
  place_type?: string
  opens_at?: string
  introduction?: string
  created_at: string
  updated_at: string
}

export interface Prompt {
  id: string
  query_text: string
  total_requested: number
  total_found: number
  created_at: string
}

export interface PromptToCompany {
  id: string
  prompt_id: string
  company_id: string
  created_at: string
}

export interface Contact {
  id: string
  company_id: string
  first_name: string
  last_name?: string
  email?: string
  bio?: string
  linkedin_url?: string
  created_at: string
  updated_at: string
}

export interface ContactEmail {
  id: string
  contact_id: string
  email: string
  created_at: string
  updated_at: string
}

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  
  if (!url || !key || url.includes('your_') || key.includes('your_')) {
    console.warn('Supabase not properly configured. Using fallback values.')
    return false
  }
  return true
}

// Database utility functions - Updated for unified company schema
export const dbUtils = {
  // Create a new prompt
  async createPrompt(query_text: string, total_requested: number = 20, total_found: number = 0) {
    if (!isSupabaseConfigured()) {
      throw new Error('Database not configured. Please set up Supabase environment variables.')
    }

    const { data, error } = await supabase
      .from('prompt')
      .insert([{ query_text, total_requested, total_found }])
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', JSON.stringify(error, null, 2))
      throw new Error(`Database error: ${error.message || error.details || 'Unknown database error'}`)
    }
    return data as Prompt
  },

  // Update prompt with total found
  async updatePromptTotalFound(promptId: string, total_found: number) {
    const { data, error } = await supabase
      .from('prompt')
      .update({ total_found })
      .eq('id', promptId)
      .select()
      .single()
    
    if (error) throw error
    return data as Prompt
  },

  // Create or get existing company by normalized_domain
  async upsertCompany(companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('company')
      .upsert([companyData], { onConflict: 'normalized_domain' })
      .select()
      .single()
    
    if (error) throw error
    return data as Company
  },

  // Create relationship between prompt and company
  async linkPromptToCompany(promptId: string, companyId: string) {
    const { data, error } = await supabase
      .from('prompt_to_company')
      .upsert([{ prompt_id: promptId, company_id: companyId }], { 
        onConflict: 'prompt_id,company_id',
        ignoreDuplicates: true 
      })
      .select()
    
    if (error && !error.message.includes('duplicate')) {
      throw error
    }
    return data
  },

  // Get companies for a specific prompt
  async getCompaniesByPrompt(promptId: string) {
    const { data, error } = await supabase
      .from('prompt_to_company')
      .select(`
        company (
          id,
          name,
          address,
          website,
          normalized_domain,
          phone_number,
          introduction,
          created_at,
          updated_at
        )
      `)
      .eq('prompt_id', promptId)
    
    if (error) throw error
    return data.map(item => item.company) as Company[]
  },

  // Get all prompts with their company counts
  async getAllPromptsWithCounts() {
    const { data, error } = await supabase
      .from('prompt')
      .select(`
        *,
        prompt_to_company(count)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }
}