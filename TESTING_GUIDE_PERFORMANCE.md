# Testing Guide for Performance Optimizations

## Pre-Test Checklist
- [ ] Clear browser cache
- [ ] Open browser DevTools Console
- [ ] Enable Performance Monitor in DevTools

## Test 1: Basic Sprite Creation and Switching

### Steps:
1. Open the editor
2. Create a new sprite (16x16) - should work normally
3. Create a large sprite (128x128)
4. Switch between the two sprites multiple times
5. Check console for performance logs

### Expected Results:
- ✅ No `row.map is not a function` errors
- ✅ Sprite switching completes in <250ms for large sprites
- ✅ Loading indicator appears briefly during switching
- ✅ Console shows TypedArray usage for large sprites

## Test 2: Drawing and Editing

### Steps:
1. Load/create a 128x128 sprite
2. Select the Brush tool
3. Draw several strokes across the canvas
4. Use Eraser tool
5. Use Bucket Fill tool

### Expected Results:
- ✅ Drawing operations feel responsive (<100ms)
- ✅ No lag or stuttering
- ✅ No console errors

## Test 3: Undo/Redo

### Steps:
1. On a large sprite (128x128)
2. Make 5-10 drawing operations
3. Press Undo multiple times (Ctrl+Z or button)
4. Press Redo multiple times (Ctrl+Y or button)

### Expected Results:
- ✅ Undo/Redo completes in <150ms
- ✅ No console errors
- ✅ Canvas updates correctly

## Test 4: Layer Operations

### Steps:
1. Create a large sprite (128x128)
2. Add 3-4 layers
3. Draw on different layers
4. Toggle layer visibility
5. Change layer opacity
6. Merge layers

### Expected Results:
- ✅ Layer operations are fast
- ✅ Compositing works correctly
- ✅ No visual glitches

## Test 5: Animation Frames

### Steps:
1. Create an animated sprite (128x128, 3 frames)
2. Draw on frame 1
3. Switch to frame 2
4. Draw on frame 2
5. Switch back to frame 1
6. Duplicate a frame

### Expected Results:
- ✅ Frame switching works smoothly
- ✅ No `row.map is not a function` errors
- ✅ Frame data is preserved correctly
- ✅ Duplicate frame works

## Test 6: Import/Export

### Steps:
1. Import a large PNG (>100x100)
2. Edit the sprite
3. Export as PNG
4. Export as JSON
5. Import the JSON back

### Expected Results:
- ✅ Import completes successfully
- ✅ Export works correctly
- ✅ Re-imported sprite looks identical

## Test 7: Memory Usage

### Steps:
1. Open Chrome DevTools > Memory tab
2. Take a heap snapshot
3. Create 5 large sprites (128x128 each)
4. Switch between them multiple times
5. Take another heap snapshot
6. Compare memory usage

### Expected Results:
- ✅ Memory usage increases moderately (not exponentially)
- ✅ No memory leaks when switching sprites
- ✅ Garbage collection occurs normally

## Test 8: WebGL Rendering

### Steps:
1. Create a sprite <100x100 (should use Canvas2D)
2. Create a sprite >100x100 (should use WebGL)
3. Check console for renderer type
4. Zoom in/out on both sprites

### Expected Results:
- ✅ Small sprites use Canvas2D
- ✅ Large sprites use WebGL
- ✅ Both render correctly with transparency checkerboard
- ✅ Grid overlay works on both

## Performance Benchmarks

Record these times in console:

| Operation | Before | After | Target |
|-----------|--------|-------|--------|
| Load 128x128 sprite | ~1000ms | ? | <250ms |
| Draw on 128x128 | ~500ms | ? | <100ms |
| Undo on 128x128 | ~800ms | ? | <150ms |
| Switch sprites | ~1500ms | ? | <250ms |

## Common Issues and Solutions

### Issue: "row.map is not a function"
**Solution**: This error should be fixed. If it still appears, check which file/line and update that location to handle TypedArrays.

### Issue: Sprites look corrupted
**Solution**: Clear localStorage and reload. The conversion from 2D arrays to TypedArrays should be automatic.

### Issue: WebGL not working
**Solution**: Check if WebGL is enabled in browser. Try visiting https://get.webgl.org/ to verify.

### Issue: Performance not improved
**Solution**: 
1. Check if sprite is actually large enough (>100x100)
2. Verify TypedArrays are being used (check console)
3. Clear browser cache
4. Check if hardware acceleration is enabled

## Browser Compatibility

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)

## Reporting Issues

If you encounter issues, include:
1. Browser and version
2. Sprite dimensions
3. Console errors (full stack trace)
4. Steps to reproduce
5. Screenshot of the issue