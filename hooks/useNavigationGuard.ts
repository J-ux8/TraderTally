/**
 * Navigation Guard Hook
 * 
 * Provides navigation protection to ensure users can't navigate back to 
 * authentication screens when logged in, and vice versa.
 */

import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';

export function useNavigationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const checkNavigationPermissions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthenticated = !!session?.user;
        
        // Define route categories
        const authRoutes = ['/welcome', '/Authentication/login', '/Authentication/register', '/Authentication/verify-email'];
        const protectedRoutes = ['/(tabs)', '/unlock'];
        
        const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
        const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

        // Redirect logic
        if (isAuthenticated && isAuthRoute) {
          console.log('[NavigationGuard] Redirecting authenticated user to app');
          router.replace('/(tabs)');
        } else if (!isAuthenticated && isProtectedRoute) {
          console.log('[NavigationGuard] Redirecting unauthenticated user to welcome');
          router.replace('/welcome');
        }
      } catch (error) {
        console.error('[NavigationGuard] Error checking navigation permissions:', error);
      }
    };

    checkNavigationPermissions();
  }, [pathname]);

  // Global Auth State Change Listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const isAuthenticated = !!session?.user;
      
      if (event === 'SIGNED_IN' && isAuthenticated) {
        router.replace('/(tabs)');
      } else if (event === 'SIGNED_OUT' || (event === 'USER_UPDATED' && !isAuthenticated)) {
        // Precise logout redirection to the login screen for smoothness
        if (!pathname.includes('Authentication') && pathname !== '/welcome') {
          router.replace('/Authentication/login');
        }
      }
    });

    return () => subscription?.unsubscribe();
  }, [pathname]);
}