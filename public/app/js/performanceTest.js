// Performance Testing Utility for Pixel Editor
// Add this to your browser console or include in editor.html

class PerformanceTest {
  constructor(editor) {
    this.editor = editor;
    this.results = [];
  }

  /**
   * Test sprite switching performance
   */
  async testSpriteSwitch() {
    console.log('🧪 Testing sprite switch performance...');
    
    // Create two test sprites
    const sprite1 = this.editor.createNewSprite(200, 200, 'Test Sprite 1');
    const sprite2 = this.editor.createNewSprite(200, 200, 'Test Sprite 2');
    
    // Fill with some data
    for (let i = 0; i < 100; i++) {
      const x = Math.floor(Math.random() * 200);
      const y = Math.floor(Math.random() * 200);
      this.editor.layerManager.setPixel(x, y, [255, 0, 0, 255]);
    }
    
    // Switch to sprite1
    this.editor.setCurrentSprite(sprite1);
    
    // Measure switch to sprite2
    const t0 = performance.now();
    this.editor.setCurrentSprite(sprite2);
    const t1 = performance.now();
    
    const duration = t1 - t0;
    this.results.push({ test: 'Sprite Switch (200×200)', duration });
    
    console.log(`✅ Sprite switch: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Test drawing performance
   */
  testDrawing() {
    console.log('🧪 Testing drawing performance...');
    
    // Create test sprite
    const sprite = this.editor.createNewSprite(200, 200, 'Draw Test');
    this.editor.setCurrentSprite(sprite);
    
    // Simulate 100 pixel brush stroke
    const t0 = performance.now();
    
    this.editor.layerManager.startBatchOperation();
    for (let i = 0; i < 100; i++) {
      const x = 50 + i;
      const y = 50;
      this.editor.layerManager.setPixel(x, y, [255, 0, 0, 255]);
    }
    this.editor.layerManager.endBatchOperation();
    
    const t1 = performance.now();
    
    const duration = t1 - t0;
    this.results.push({ test: 'Draw 100 pixels', duration });
    
    console.log(`✅ Drawing: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Test undo/redo performance
   */
  testUndoRedo() {
    console.log('🧪 Testing undo/redo performance...');
    
    // Create test sprite and draw something
    const sprite = this.editor.createNewSprite(200, 200, 'Undo Test');
    this.editor.setCurrentSprite(sprite);
    
    this.editor.layerManager.startBatchOperation();
    for (let i = 0; i < 100; i++) {
      this.editor.layerManager.setPixel(50 + i, 50, [255, 0, 0, 255]);
    }
    this.editor.layerManager.endBatchOperation();
    
    // Test undo
    const t0 = performance.now();
    this.editor.layerManager.undo();
    const t1 = performance.now();
    
    // Test redo
    const t2 = performance.now();
    this.editor.layerManager.redo();
    const t3 = performance.now();
    
    const undoDuration = t1 - t0;
    const redoDuration = t3 - t2;
    
    this.results.push({ test: 'Undo', duration: undoDuration });
    this.results.push({ test: 'Redo', duration: redoDuration });
    
    console.log(`✅ Undo: ${undoDuration.toFixed(2)}ms`);
    console.log(`✅ Redo: ${redoDuration.toFixed(2)}ms`);
    
    return { undo: undoDuration, redo: redoDuration };
  }

  /**
   * Test history memory usage
   */
  testHistoryMemory() {
    console.log('🧪 Testing history memory usage...');
    
    const sprite = this.editor.createNewSprite(200, 200, 'Memory Test');
    this.editor.setCurrentSprite(sprite);
    
    // Record initial memory
    const initialMem = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // Do 20 strokes
    for (let stroke = 0; stroke < 20; stroke++) {
      this.editor.layerManager.startBatchOperation();
      for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * 200);
        const y = Math.floor(Math.random() * 200);
        this.editor.layerManager.setPixel(x, y, [255, 0, 0, 255]);
      }
      this.editor.layerManager.endBatchOperation();
    }
    
    // Record final memory
    const finalMem = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryUsed = (finalMem - initialMem) / 1024 / 1024; // MB
    
    console.log(`✅ Memory used for 20 strokes: ${memoryUsed.toFixed(2)} MB`);
    console.log(`   Patch history enabled: ${this.editor.layerManager.usePatchHistory}`);
    
    return memoryUsed;
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('🚀 Running all performance tests...\n');
    
    this.results = [];
    
    await this.testSpriteSwitch();
    this.testDrawing();
    this.testUndoRedo();
    
    if (performance.memory) {
      this.testHistoryMemory();
    }
    
    console.log('\n📊 Performance Test Results:');
    console.table(this.results);
    
    // Check if performance is acceptable
    const failures = this.results.filter(r => r.duration > 100);
    if (failures.length > 0) {
      console.warn('⚠️ Some operations took longer than 100ms:', failures);
    } else {
      console.log('✅ All operations completed in under 100ms!');
    }
    
    return this.results;
  }

  /**
   * Compare with target performance
   */
  checkTargets() {
    const targets = {
      'Sprite Switch (200×200)': 100,
      'Draw 100 pixels': 50,
      'Undo': 50,
      'Redo': 50
    };
    
    console.log('\n🎯 Performance vs Targets:');
    
    const comparison = this.results.map(r => {
      const target = targets[r.test];
      if (!target) return null;
      
      const passed = r.duration < target;
      const margin = ((target - r.duration) / target * 100).toFixed(1);
      
      return {
        test: r.test,
        actual: `${r.duration.toFixed(2)}ms`,
        target: `${target}ms`,
        status: passed ? '✅ PASS' : '❌ FAIL',
        margin: passed ? `${margin}% faster` : `${Math.abs(margin)}% slower`
      };
    }).filter(Boolean);
    
    console.table(comparison);
  }
}

// Make it globally available
window.PerformanceTest = PerformanceTest;

// Quick test function
window.testEditorPerformance = async function() {
  if (!window.editor) {
    console.error('❌ Editor not initialized. Wait for page to load.');
    return;
  }
  
  const test = new PerformanceTest(window.editor);
  await test.runAll();
  test.checkTargets();
  
  // Show performance metrics from editor
  console.log('\n📈 Editor Performance Metrics:');
  console.table(window.editor._performanceMetrics);
  
  return test.results;
};

console.log('✅ Performance testing utilities loaded!');
console.log('📝 Run tests with: await testEditorPerformance()');
