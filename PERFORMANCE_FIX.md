# Performance Regression Analysis

## Issue
After WebP optimization, pages are loading **slower** instead of faster.

## Root Causes

### 1. **Lazy Loading Overhead**
- All components are lazy-loaded via `React.lazy()`
- Creates delay while chunks download
- User sees blank/minimal screen during load
- **Impact:** Perceived performance worse despite smaller bundle

### 2. **CSS Background Images Not Optimized**
- `kanto-map.webp` loaded via CSS `backgroundImage:` 
- Arena backgrounds loaded via CSS in `RoomSelect.tsx`
- These bypass Next.js Image optimization
- No lazy loading, no responsive sizing
- **Impact:** Large images load eagerly on navigation

### 3. **Missing Image Preloading Strategy**
- Critical images not marked with `priority`
- No preconnect hints for external resources
- **Impact:** Waterfall loading delays

## Solutions

### Option A: Remove Lazy Loading (Fast Fix)
```tsx
// Before: lazy loaded
const SignupFlow = lazy(() => import('@/components/SignupFlow'));

// After: eager loaded
import SignupFlow from '@/components/SignupFlow';
```
**Pros:** Instant navigation, simpler code
**Cons:** Larger initial bundle (~500KB more)
**Recommendation:** ✅ Do this - better UX

### Option B: Convert CSS Backgrounds to Next Image
```tsx
// Before:
<div style={{ backgroundImage: 'url(/kanto-map.webp)' }} />

// After:
<Image src="/kanto-map.webp" fill loading="lazy" />
```
**Pros:** Proper lazy loading, responsive sizing
**Cons:** More complex styling
**Recommendation:** ⚠️ Do this for arena backgrounds

### Option C: Add Image Preloading
```tsx
<link rel="preload" as="image" href="/kanto-map.webp" />
```
**Pros:** Faster perceived load
**Cons:** Loads images user might not need
**Recommendation:** ❌ Skip - adds bloat

## Recommended Fix
1. **Remove lazy loading** from frequently-used components
2. **Keep lazy loading** only for:
   - Admin panel
   - Battle screens (only shown after queue)
   - Friend battle (less common)
3. **Add loading="lazy"** to CSS background divs where possible

## File Sizes for Reference
```
public/Perfect.webp:     ~500KB (home screen, eager)
public/kanto-map.webp:   ~800KB (room select, CSS bg)
public/arenas/*.webp:    14 files, ~49MB total
```

The arena images are fine (lazy-loaded per room card).
Main issue: **lazy component chunks** creating blank screen delays.
