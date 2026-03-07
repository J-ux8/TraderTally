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
        return await categoryRepo.findAll(userId);
    } catch (error) {
        console.error("Error in getUserCategories:", error);
        return [];
    }
}

export async function addCategory(name: string): Promise<Category> {
    const userId = await getUserId();

    const category = await categoryRepo.createCategory(userId, name);

    // Background sync trigger
    SyncEngine.executeFullSync(userId).catch(console.error);

    return category;
}

export async function deleteCategory(id: string) {
    const userId = await getUserId();

    await categoryRepo.softDelete(id, userId);

    // Background sync trigger
    SyncEngine.executeFullSync(userId).catch(console.error);
}
