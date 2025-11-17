# Performance Optimizations

This document describes the performance optimizations implemented in the frontend application.

## Code Splitting

### Route-Based Code Splitting
All pages are lazy-loaded using `React.lazy()` to reduce initial bundle size:

```typescript
const HomePage = lazy(() => import('./pages/HomePage'));
const TtsMainPage = lazy(() => import('./features/tts/pages/TtsMainPage'));
// ... etc
```

### Manual Chunk Splitting
Vite configuration includes manual chunk splitting for optimal caching:

- **react-vendor**: React core libraries (react, react-dom, react-router)
- **react-query**: @tanstack/react-query
- **ui-icons**: lucide-react
- **radix-ui**: All Radix UI components
- **forms**: react-hook-form and related
- **validation**: Zod validation library
- **Feature chunks**: Separate chunks for admin, tts, and drops features

Benefits:
- Parallel loading of vendor chunks
- Better browser caching (vendor code changes less frequently)
- Smaller initial bundle size

## Asset Loading Optimizations

### Image Optimization
1. **Lazy Loading**: All images use `loading="lazy"` attribute
2. **Async Decoding**: Images use `decoding="async"` for non-blocking rendering
3. **OptimizedImage Component**: Custom component with Intersection Observer for advanced lazy loading

```typescript
<OptimizedImage 
  src="/path/to/image.jpg" 
  alt="Description"
  eager={false} // Set to true for above-the-fold images
/>
```

### Font Loading
1. **Preconnect**: Early connection to Google Fonts
2. **Font Display Swap**: Uses `display=swap` for immediate text rendering
3. **Preload**: Critical Inter font is preloaded
4. **Deferred Loading**: Decorative fonts load with `media="print"` then switch to `all`

## API Call Optimizations

### React Query Configuration
Aggressive caching strategy to minimize API calls:

```typescript
{
  staleTime: 5 * 60 * 1000,      // 5 minutes
  gcTime: 10 * 60 * 1000,        // 10 minutes
  refetchOnWindowFocus: false,   // Don't refetch on focus
  refetchOnMount: false,         // Don't refetch if data is fresh
  retry: 1,                      // Single retry on failure
}
```

### Request Deduplication
Prevents duplicate API calls within a 100ms window:

```typescript
import { requestDeduplicator } from '@/utils/requestDeduplication';

const data = await requestDeduplicator.deduplicate(
  'unique-key',
  () => apiClient.get('/endpoint')
);
```

### Debounced Queries
For search and user input:

```typescript
import { useDebouncedQuery } from '@/hooks/useDebouncedQuery';

const { data, isDebouncing } = useDebouncedQuery({
  queryKey: ['search'],
  queryFn: () => searchApi(searchTerm),
  searchTerm,
  debounceMs: 300,
});
```

### Batched Requests
Combine multiple requests into a single API call:

```typescript
import { useBatchedRequests } from '@/hooks/useBatchedRequests';

const { request } = useBatchedRequests({
  batchFn: (ids) => fetchMultipleItems(ids),
  maxBatchSize: 10,
  batchDelay: 50,
});
```

## Performance Monitoring

### Built-in Performance Monitor
Track slow operations in development:

```typescript
import { performanceMonitor } from '@/utils/performanceMonitor';

const data = await performanceMonitor.measure(
  'fetchUserData',
  () => apiClient.get('/users')
);

// View metrics in console
performanceMonitor.logSummary();
```

Access in browser console (dev mode):
```javascript
window.performanceMonitor.getSlowestOperations(10);
```

## Build Optimizations

### Vite Configuration
- **esbuild minification**: Faster than terser
- **CSS code splitting**: Separate CSS files per route
- **Asset inlining**: Small files (<4KB) inlined as base64
- **Compressed size reporting disabled**: Faster builds
- **Target esnext**: Modern JavaScript for smaller bundles

### Dependency Optimization
Pre-bundled dependencies for faster dev server startup:
- react, react-dom, react-router-dom
- axios
- @tanstack/react-query

Heavy libraries excluded from pre-bundling:
- recharts (loaded on-demand)

## Best Practices

### 1. Use React Query for Server State
```typescript
// ✅ Good
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// ❌ Bad
useEffect(() => {
  fetchUsers().then(setUsers);
}, []);
```

### 2. Lazy Load Heavy Components
```typescript
// ✅ Good
const HeavyChart = lazy(() => import('./HeavyChart'));

// ❌ Bad
import HeavyChart from './HeavyChart';
```

### 3. Optimize Images
```typescript
// ✅ Good
<OptimizedImage src="/image.jpg" alt="Description" />

// ❌ Bad
<img src="/image.jpg" alt="Description" />
```

### 4. Debounce User Input
```typescript
// ✅ Good
const [debouncedValue] = useDebounce(searchTerm, 300);

// ❌ Bad
// Triggering API call on every keystroke
```

### 5. Use Memoization
```typescript
// ✅ Good
const expensiveValue = useMemo(() => computeExpensive(data), [data]);

// ❌ Bad
const expensiveValue = computeExpensive(data); // Runs every render
```

## Performance Metrics

### Target Metrics
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Total Blocking Time (TBT)**: < 300ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### Measuring Performance
Use Lighthouse in Chrome DevTools:
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" category
4. Click "Analyze page load"

## Future Optimizations

### Potential Improvements
1. **Service Worker**: Cache API responses offline
2. **HTTP/2 Server Push**: Push critical resources
3. **WebP Images**: Convert images to WebP format
4. **Virtual Scrolling**: Already implemented for long lists
5. **Prefetching**: Prefetch likely next pages
6. **Bundle Analysis**: Regular analysis with `vite-bundle-visualizer`

### Monitoring
Consider adding:
- Real User Monitoring (RUM)
- Error tracking (Sentry)
- Performance budgets in CI/CD
- Automated Lighthouse CI checks
