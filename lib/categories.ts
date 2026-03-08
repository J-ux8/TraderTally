import { Category, categoryRepo } from "./offline/repositories/CategoryRepository";
import { supabase } from "./supabase";
import { SyncEngine } from "./offline/sync/SyncEngine";
import { getCachedSession } from "./session-cache";

export { Category };

// Helper function to get user ID with cache fallback for offline support
async function getUserId(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;
  } catch (error) {
    console.log('[Offline Mode] Supabase auth failed, using cached session');
  }
  
  const cached = await getCachedSession();
  if (!cached) throw new Error("User not authenticated and no cached session");
  return cached.userId;
}

export async function getUserCategories(): Promise<Category[]> {
    try {
        const userId = await getUserId();
        console.log('[Categories] Loading categories for user:', userId);
        const categories = await categoryRepo.findAll(userId);
        console.log('[Categories] Found', categories.length, 'categories');
        if (categories.length > 0) {
            console.log('[Categories] Sample:', categories[0].name);
        }
        return categories;
    } catch (error) {
        console.error("Error in getUserCategories:", error);
        return [];
    }
}

export async function addCategory(name: string): Promise<Category> {
    const userId = await getUserId();

    const category = await categoryRepo.createCategory(userId, name);

    // Trigger background sync (non-blocking, don't wait for it)
    SyncEngine.executeFullSync(userId).catch(syncError => {
        console.log('[Offline] Category created locally, sync will retry later');
    });

    return category;
}

export async function deleteCategory(id: string) {
    const userId = await getUserId();

    await categoryRepo.softDelete(id, userId);

    // Trigger background sync (non-blocking, don't wait for it)
    SyncEngine.executeFullSync(userId).catch(syncError => {
        console.log('[Offline] Category deleted locally, sync will retry later');
    });
}
