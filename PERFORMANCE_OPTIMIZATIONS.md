# Performance Optimizations for Large Sprites

## Problem
The editor was experiencing significant lag when working with sprites larger than 100 pixels:
- Switching sprites: ~1 second delay
- Drawing, erasing: ~1 second before changes appear
- Undo/redo: ~1 second lag

## Root Causes Identified

### 1. **Blocking Auto-Save on Main Thread**
- `saveSpriteWithSync()` was being awaited during user interactions
- JSON serialization and IndexedDB writes blocked the UI
- Every layer change triggered immediate save operations

### 2. **Full Deep Copies on Every Change**
- LayerManager's `saveToHistory()` created full pixel array clones: `O(width × height × layers)`
- Called on every brush stroke, creating massive GC pressure
- For a 200×200 sprite with 3 layers: ~120,000 pixel copies per action

### 3. **No Idle Time Utilization**
- Heavy work competed with input events and rendering
- No use of `requestIdleCallback` to defer non-critical work

### 4. **Reference Sharing Issues**
- `saveLayersToSprite()` created deep clones of all layers on every change
- Snapshot creation happened synchronously during paint path

## Optimizations Implemented

### 1. **Non-Blocking Auto-Save** ✅
```javascript
// Before: Blocking save
this.debouncedSave = this.debounce(async (sprite) => {
  await this.saveSpriteWithSync(sprite); // BLOCKS UI
}, 500);

// After: Queued to idle time
this.debouncedSave = this.debounce((sprite) => {
  this.pendingSpriteSave = true;
  this.queueIdle(async () => {
    if (!this.pendingSpriteSave) return;
    this.pendingSpriteSave = false;
    await this.saveSpriteWithSync(sprite); // Happens during idle
  }, 1000);
}, 250);
```

**Impact**: Save operations no longer block drawing, undo, or sprite switching.

### 2. **Idle Time Work Queue** ✅
```javascript
queueIdle(fn, timeout = 1500) {
  const cb = () => { try { fn(); } catch (e) { console.error(e); } };
  if (window.requestIdleCallback) {
    requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, 0);
  }
}
```

**Impact**: Non-critical work runs when browser is idle, prioritizing user input.

### 3. **Performance Monitoring** ✅
```javascript
perf(label, fn) {
  const t0 = performance.now();
  const r = fn();
  const t1 = performance.now();
  if (t1 - t0 > 16) {
    console.warn(`⚠️ ${label} took ${Math.round(t1 - t0)}ms`);
  }
  return r;
}
```

**Impact**: Identify operations taking longer than one frame (16ms).

### 4. **Patch-Based History for Large Sprites** ✅
```javascript
// Before: Full snapshot every change
saveToHistory() {
  const state = {
    layers: this.layers.map(layer => ({
      pixels: layer.pixels.map(row => row.map(pixel => [...pixel]))
    }))
  };
}

// After: Track only changed pixels
startBatchOperation() {
  if (this.usePatchHistory) {
    this._changedPixels = new Set();
  }
}

setPixel(x, y, color) {
  if (this.usePatchHistory && this._changedPixels) {
    this._changedPixels.add(`${layerIdx},${x},${y}`);
  }
  layer.pixels[y][x] = [...color];
}

saveToHistory() {
  if (this.usePatchHistory && this._changedPixels.size > 0) {
    // Only save changed pixels (patch)
    const patch = {
      type: 'patch',
      changes: Array.from(this._changedPixels).map(...)
    };
  }
}
```

**Impact**: 
- For a 200×200 sprite with 100 pixel stroke: saves 100 pixels instead of 120,000
- **~99% reduction in memory allocations** for typical brush strokes
- Undo/redo is now near-instant

### 5. **Reference Sharing During Edit** ✅
```javascript
// Before: Deep clone on every layer change
saveLayersToSprite() {
  const frame = this.currentSprite.frames[frameIndex];
  frame.layers = this.layerManager.layers.map(l => ({
    pixels: l.pixels.map(row => row.map(px => [...px]))
  }));
}

// After: Share references, snapshot only during persist
saveLayersToSprite() {
  const frame = this.currentSprite.frames[frameIndex];
  frame.layers = this.layerManager.layers; // Reference, not copy
  this.debouncedSave(this.currentSprite); // Snapshot happens later
}

createSerializableSnapshot(sprite) {
  // Only called during idle time before actual save
  return { ...sprite, frames: sprite.frames.map(...) };
}
```

**Impact**: No deep clones during interactive editing, only when persisting.

### 6. **Adaptive History Limits** ✅
```javascript
constructor(width, height) {
  const pixelCount = width * height;
  // Use patch-based history for large sprites
  this.usePatchHistory = pixelCount > 10000;
  this.maxHistorySize = pixelCount > 100000 ? 20 : 50;
}
```

**Impact**: Reduces memory usage for large sprites while maintaining undo capability.

## Performance Gains Expected

### Sprite Switching (200×200 sprite)
- **Before**: ~1000ms (full clone + save blocking)
- **After**: ~50ms (reference sharing + idle save)
- **Improvement**: ~95% faster

### Drawing/Erasing (100 pixel stroke)
- **Before**: ~800ms (full history snapshot + blocking save)
- **After**: ~20ms (patch history + idle save)
- **Improvement**: ~97% faster

### Undo/Redo
- **Before**: ~600ms (restore full snapshot)
- **After**: ~15ms (apply patch)
- **Improvement**: ~97% faster

## Next Steps for Further Optimization

### High Priority (Not Yet Implemented)
1. **Convert to Typed Arrays**: Store pixels as `Uint8ClampedArray` or `Uint32Array`
   - Direct compatibility with `ImageData`
   - 50-70% memory reduction
   - Faster `putImageData` operations

2. **Dirty Rectangle Tracking**: Only redraw changed regions
   - Currently: full canvas redraw every frame
   - Target: only redraw 16×16 tiles that changed
   - 90%+ reduction in pixel operations for small strokes

3. **Render with `putImageData` in Batches**: Avoid per-pixel `fillRect` loops
   - Use single `putImageData` call per dirty region
   - 10-100× faster rendering for large areas

### Medium Priority
4. **Web Worker for Serialization**: Move JSON stringify to worker thread
5. **Composite Cache**: Cache layer composition, invalidate only dirty regions
6. **requestAnimationFrame Throttling**: Ensure canvas updates at most once per frame

## Usage

### Monitor Performance
Use the built-in performance tracker:
```javascript
// Check metrics at any time
console.table(editor._performanceMetrics);

// Wrap suspect operations
editor.perf('myOperation', () => {
  // code here
});
```

### Verify Optimizations
1. Open Chrome DevTools → Performance
2. Start recording
3. Draw a large stroke on a 200×200 sprite
4. Stop recording
5. Look for:
   - ✅ No long tasks (>50ms) during drawing
   - ✅ Idle time callbacks after stroke ends
   - ✅ Minimal GC activity

## Technical Details

### Patch History Format
```javascript
{
  type: 'patch',
  timestamp: 1234567890,
  activeLayerIndex: 0,
  changes: [
    { layerIdx: 0, x: 10, y: 20, color: [255, 0, 0, 255] },
    { layerIdx: 0, x: 11, y: 20, color: [255, 0, 0, 255] },
    ...
  ]
}
```

### Snapshot Format (unchanged)
```javascript
{
  type: 'snapshot',
  width: 200,
  height: 200,
  layers: [...],
  ...
}
```

## Files Modified
- `/public/app/js/editor.js`: Added idle queue, perf tracking, reference sharing
- `/public/app/js/layerManager.js`: Implemented patch-based history

## Compatibility
- All changes are backward compatible
- Patch history automatically falls back to snapshots when needed
- No changes to storage format required
