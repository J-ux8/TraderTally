import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";

export interface Template extends LocalBaseModel {
  name: string;
  type: 'sale' | 'expense';
  default_amount: number;
  category: string | null;
  description: string | null;
}

export interface TemplateInput {
  name: string;
  type: 'sale' | 'expense';
  default_amount: number;
  category?: string | null;
  description?: string | null;
}

/**
 * Validate template input
 */
export function validateTemplateInput(input: TemplateInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) errors.push('Template name is required');
  if (!input.type || !['sale', 'expense'].includes(input.type)) errors.push('Transaction type must be "sale" or "expense"');
  if (input.default_amount === undefined || input.default_amount <= 0) errors.push('Amount must be greater than 0');
  return { valid: errors.length === 0, errors };
}

/**
 * Create a new template
 */
export async function createTemplate(input: TemplateInput): Promise<Template> {
  const validation = validateTemplateInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(', '));

  const record = await LocalDB.create<Template>('transaction_templates', {
    name: input.name.trim(),
    type: input.type,
    default_amount: input.default_amount,
    category: input.category || null,
    description: input.description || null
  } as any);

  SyncEngine.syncAll().catch(console.error);
  return record;
}

/**
 * Get all templates
 */
export async function getTemplates(): Promise<Template[]> {
  return await LocalDB.getAll<Template>('transaction_templates');
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string): Promise<Template> {
  const template = await LocalDB.getById<Template>('transaction_templates', id);
  if (!template) throw new Error('Template not found');
  return template;
}

/**
 * Update template
 */
export async function updateTemplate(id: string, input: TemplateInput): Promise<Template> {
  const validation = validateTemplateInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(', '));

  await LocalDB.update('transaction_templates', id, {
    name: input.name.trim(),
    type: input.type,
    default_amount: input.default_amount,
    category: input.category || null,
    description: input.description || null
  });

  const updated = await getTemplateById(id);
  SyncEngine.syncAll().catch(console.error);
  return updated;
}

/**
 * Delete template (Soft delete)
 */
export async function deleteTemplate(id: string): Promise<void> {
  await LocalDB.delete('transaction_templates', id);
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Misc helper functions
 */
export async function useTemplateForTransaction(templateId: string): Promise<Template> {
  return getTemplateById(templateId);
}
