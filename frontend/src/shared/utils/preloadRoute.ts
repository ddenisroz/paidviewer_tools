/**
 * Preload utility for lazy-loaded routes
 * Preloads route components on hover to improve perceived performance
 */

type _PreloadableComponent = {
    preload?: () => Promise<unknown>;
};

const preloadedRoutes = new Set<string>();

/**
 * Preload a lazy-loaded component
 * @param componentLoader - The lazy component loader function
 * @param routeName - Unique identifier for the route (for caching)
 */
export const preloadRoute = (componentLoader: () => Promise<unknown>, routeName: string): void => {
    // Only preload once per route
    if (preloadedRoutes.has(routeName)) {
        return;
    }

    preloadedRoutes.add(routeName);

    // Trigger the lazy load
    componentLoader().catch((error) => {
        console.warn(`Failed to preload route ${routeName}:`, error);
        // Remove from cache so it can be retried
        preloadedRoutes.delete(routeName);
    });
};

/**
 * Create a preload handler for navigation links
 * Usage: <Link to="/admin" onMouseEnter={createPreloadHandler(AdminPage, 'admin')}>
 */
export const createPreloadHandler = (componentLoader: () => Promise<unknown>, routeName: string) => {
    return () => preloadRoute(componentLoader, routeName);
};

/**
 * Preload multiple routes at once
 * Useful for preloading related routes
 */
export const preloadRoutes = (routes: Array<{ loader: () => Promise<unknown>; name: string }>): void => {
    routes.forEach(({ loader, name }) => {
        preloadRoute(loader, name);
    });
};

/**
 * Clear preload cache (useful for testing or memory management)
 */
export const clearPreloadCache = (): void => {
    preloadedRoutes.clear();
};
