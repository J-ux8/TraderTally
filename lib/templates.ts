import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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

  // Validate input
  const validation = validateTemplateInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const templateId = uuidv4();
  const now = new Date().toISOString();

  const template: Template = {
    id: templateId,
    user_id: user.id,
    name: input.name.trim(),
    type: input.type,
    default_amount: input.default_amount,
    category: input.category || null,
    description: input.description || null,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  };

  const { data, error } = await supabase
    .from('transaction_templates')
    .insert([template])
    .select()
    .single();

  if (error) throw new Error(`Failed to create template: ${error.message}`);
  return data as Template;
}

/**
 * Get all active templates for current user
 */
export async function getTemplates(limit: number = 100, offset: number = 0): Promise<Template[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('transaction_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_deleted', 0)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
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
