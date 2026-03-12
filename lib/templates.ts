import { supabase } from '@/lib/supabase';

/**
 * Debug function to test Supabase connection and table existence
 */
export async function debugTemplatesTable(): Promise<void> {
  try {
    console.log('[Templates Debug] Testing Supabase connection...');
    
    // Test authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[Templates Debug] Auth error:', authError);
      return;
    }
    if (!user) {
      console.log('[Templates Debug] No authenticated user');
      return;
    }
    console.log('[Templates Debug] User authenticated:', user.id);

    // Test table access with a simple select query
    console.log('[Templates Debug] Testing table access...');
    const { data, error } = await supabase
      .from('transaction_templates')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      console.error('[Templates Debug] Table access error:', error);
      console.error('[Templates Debug] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Check if it's a table not found error
      if (error.message.includes('relation "transaction_templates" does not exist')) {
        console.error('[Templates Debug] ❌ TABLE DOES NOT EXIST! You need to run the migration in Supabase SQL Editor.');
        console.error('[Templates Debug] Run this file: supabase_migrations/create_transaction_templates_table.sql');
      }
    } else {
      console.log('[Templates Debug] ✅ Table accessible, test query successful');
      
      // Try to fetch all templates for this user
      const { data: templates, error: fetchError } = await supabase
        .from('transaction_templates')
        .select('*')
        .eq('user_id', user.id);
        
      if (fetchError) {
        console.error('[Templates Debug] Error fetching templates:', fetchError);
      } else {
        console.log('[Templates Debug] ✅ Found templates:', templates?.length || 0);
        if (templates && templates.length > 0) {
          console.log('[Templates Debug] Templates data:', templates);
        }
      }
    }
  } catch (error) {
    console.error('[Templates Debug] Unexpected error:', error);
  }
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  type: 'sale' | 'expense';
  default_amount: number;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

export interface TemplateInput {
  name: string;
  type: 'sale' | 'expense';
  default_amount: number;
  category?: string | null;
  description?: string | null;
}

export interface TemplateResponse {
  success: boolean;
  data?: Template;
  error?: string;
  message?: string;
}

export interface TemplateListResponse {
  success: boolean;
  data: Template[];
  total: number;
  hasMore: boolean;
}

/**
 * Validate template input
 */
export function validateTemplateInput(input: TemplateInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Template name is required');
  } else if (input.name.length > 100) {
    errors.push('Template name must be 100 characters or less');
  }

  // Validate type
  if (!input.type || !['sale', 'expense'].includes(input.type)) {
    errors.push('Transaction type must be "sale" or "expense"');
  }

  // Validate default_amount
  if (input.default_amount === undefined || input.default_amount === null) {
    errors.push('Amount is required');
  } else if (typeof input.default_amount !== 'number' || isNaN(input.default_amount)) {
    errors.push('Amount must be a number');
  } else if (input.default_amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  // Validate description
  if (input.description && input.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new template
 */
export async function createTemplate(input: TemplateInput): Promise<Template> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  console.log('[Templates] Creating template for user:', user.id);
  console.log('[Templates] Template input:', input);

  // Validate input
  const validation = validateTemplateInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const now = new Date().toISOString();

  const template = {
    user_id: user.id, // This will be a UUID
    name: input.name.trim(),
    type: input.type,
    default_amount: input.default_amount,
    category: input.category || null,
    description: input.description || null,
  };

  console.log('[Templates] Inserting template:', template);

  const { data, error } = await supabase
    .from('transaction_templates')
    .insert([template])
    .select()
    .single();

  if (error) {
    console.error('[Templates] Error creating template:', error);
    console.error('[Templates] Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Failed to create template: ${error.message}`);
  }
  
  console.log('[Templates] Template created successfully:', data);
  return data as Template;
}

/**
 * Get all active templates for current user
 */
export async function getTemplates(limit: number = 100, offset: number = 0): Promise<Template[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  console.log('[Templates] Fetching templates for user:', user.id);

  const { data, error } = await supabase
    .from('transaction_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_deleted', 0)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Templates] Error fetching templates:', error);
    console.error('[Templates] Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }
  
  console.log('[Templates] Raw data from Supabase:', data);
  console.log('[Templates] Found templates count:', data?.length || 0);
  
  return (data || []) as Template[];
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(id: string): Promise<Template> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('transaction_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) throw new Error(`Template not found: ${error.message}`);
  return data as Template;
}

/**
 * Update an existing template
 */
export async function updateTemplate(id: string, input: TemplateInput): Promise<Template> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate input
  const validation = validateTemplateInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('transaction_templates')
    .update({
      name: input.name.trim(),
      type: input.type,
      default_amount: input.default_amount,
      category: input.category || null,
      description: input.description || null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update template: ${error.message}`);
  return data as Template;
}

/**
 * Soft delete a template
 */
export async function deleteTemplate(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('transaction_templates')
    .update({ is_deleted: 1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(`Failed to delete template: ${error.message}`);
}

/**
 * Use a template to get data for transaction form pre-filling
 */
export async function useTemplateForTransaction(templateId: string): Promise<Template> {
  return getTemplateById(templateId);
}

/**
 * Serialize template to JSON
 */
export function serializeTemplate(template: Template): string {
  return JSON.stringify(template);
}

/**
 * Parse template from JSON
 */
export function parseTemplate(json: string): Template {
  try {
    const parsed = JSON.parse(json);
    
    // Validate required fields
    if (!parsed.id || !parsed.user_id || !parsed.name || !parsed.type || parsed.default_amount === undefined) {
      throw new Error('Invalid template data: missing required fields');
    }

    // Validate type
    if (!['sale', 'expense'].includes(parsed.type)) {
      throw new Error('Invalid template type');
    }

    // Validate amount
    if (typeof parsed.default_amount !== 'number' || parsed.default_amount <= 0) {
      throw new Error('Invalid template amount');
    }

    return parsed as Template;
  } catch (error) {
    throw new Error(`Failed to parse template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pretty print template as formatted JSON
 */
export function prettyPrintTemplate(template: Template): string {
  return JSON.stringify(template, null, 2);
}
