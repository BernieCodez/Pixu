// Test Script for Large Pixel Art Storage System
// Open browser console and run: testStorageSystem()

async function testStorageSystem() {
  console.log('🎨 Testing Pixalu Storage System...\n');
  
  const tests = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Check if systems are loaded
  console.log('1️⃣ Checking system initialization...');
  if (window.canvasStorageManager && window.cloudStorage && window.hybridStorage) {
    console.log('✅ All storage managers loaded');
    tests.push({ name: 'System Initialization', passed: true });
    passed++;
  } else {
    console.log('❌ Storage managers not loaded');
    tests.push({ name: 'System Initialization', passed: false });
    failed++;
  }

  // Test 2: Create a large sprite
  console.log('\n2️⃣ Creating large sprite (1920x1080)...');
  try {
    const largeSprite = new Sprite(1920, 1080, 'Test Large Sprite');
    
    // Add some test data
    if (largeSprite.frames && largeSprite.frames[0]) {
      const layer = largeSprite.frames[0].layers[0];
      console.log(`   Created sprite with ${largeSprite.width}x${largeSprite.height} pixels`);
      console.log(`   Using typed arrays: ${layer.useTypedArray}`);
      console.log(`   Memory size: ~${(largeSprite.width * largeSprite.height * 4 / 1024 / 1024).toFixed(2)} MB`);
      console.log('✅ Large sprite created');
      tests.push({ name: 'Large Sprite Creation', passed: true });
      passed++;
    } else {
      throw new Error('Sprite frames not initialized');
    }
  } catch (error) {
    console.log('❌ Failed to create large sprite:', error.message);
    tests.push({ name: 'Large Sprite Creation', passed: false });
    failed++;
  }

  // Test 3: Test canvas storage
  console.log('\n3️⃣ Testing canvas-based storage...');
  try {
    const testSprite = new Sprite(128, 128, 'Canvas Test Sprite');
    const startTime = performance.now();
    await window.canvasStorageManager.saveSprite(testSprite);
    const saveTime = performance.now() - startTime;
    
    console.log(`   Save time: ${saveTime.toFixed(2)}ms`);
    
    const loadStartTime = performance.now();
    const loadedSprite = await window.canvasStorageManager.loadSprite(testSprite.id);
    const loadTime = performance.now() - loadStartTime;
    
    console.log(`   Load time: ${loadTime.toFixed(2)}ms`);
    
    if (loadedSprite && loadedSprite.width === 128 && loadedSprite.height === 128) {
      console.log('✅ Canvas storage working');
      tests.push({ name: 'Canvas Storage', passed: true });
      passed++;
    } else {
      throw new Error('Loaded sprite data mismatch');
    }
    
    // Cleanup
    await window.canvasStorageManager.deleteSprite(testSprite.id);
  } catch (error) {
    console.log('❌ Canvas storage failed:', error.message);
    tests.push({ name: 'Canvas Storage', passed: false });
    failed++;
  }

  // Test 4: Test cloud storage (if user logged in)
  console.log('\n4️⃣ Testing cloud storage...');
  if (window.currentUser) {
    try {
      const cloudTestSprite = new Sprite(64, 64, 'Cloud Test Sprite');
      const cloudStartTime = performance.now();
      const cloudSaved = await window.cloudStorage.saveSprite(cloudTestSprite, window.currentUser.uid);
      const cloudSaveTime = performance.now() - cloudStartTime;
      
      console.log(`   Cloud save time: ${cloudSaveTime.toFixed(2)}ms`);
      
      if (cloudSaved) {
        const cloudLoadedSprite = await window.cloudStorage.loadSprite(cloudTestSprite.id, window.currentUser.uid);
        
        if (cloudLoadedSprite) {
          console.log('✅ Cloud storage working');
          tests.push({ name: 'Cloud Storage', passed: true });
          passed++;
          
          // Cleanup
          await window.cloudStorage.deleteSprite(cloudTestSprite.id, window.currentUser.uid);
        } else {
          throw new Error('Failed to load from cloud');
        }
      } else {
        throw new Error('Failed to save to cloud');
      }
    } catch (error) {
      console.log('❌ Cloud storage failed:', error.message);
      tests.push({ name: 'Cloud Storage', passed: false });
      failed++;
    }
  } else {
    console.log('⚠️ Skipped (user not logged in)');
    tests.push({ name: 'Cloud Storage', passed: null });
  }

  // Test 5: Test hybrid storage
  console.log('\n5️⃣ Testing hybrid storage...');
  try {
    const hybridTestSprite = new Sprite(256, 256, 'Hybrid Test Sprite');
    const hybridStartTime = performance.now();
    await window.hybridStorage.saveSprite(hybridTestSprite, {
      syncToCloud: !!window.currentUser,
      userId: window.currentUser?.uid
    });
    const hybridSaveTime = performance.now() - hybridStartTime;
    
    console.log(`   Hybrid save time: ${hybridSaveTime.toFixed(2)}ms`);
    
    const hybridLoadedSprite = await window.hybridStorage.loadSprite(hybridTestSprite.id);
    
    if (hybridLoadedSprite && hybridLoadedSprite.width === 256) {
      console.log('✅ Hybrid storage working');
      tests.push({ name: 'Hybrid Storage', passed: true });
      passed++;
    } else {
      throw new Error('Hybrid storage load failed');
    }
    
    // Cleanup
    await window.hybridStorage.deleteSprite(hybridTestSprite.id, {
      deleteFromCloud: true,
      userId: window.currentUser?.uid
    });
  } catch (error) {
    console.log('❌ Hybrid storage failed:', error.message);
    tests.push({ name: 'Hybrid Storage', passed: false });
    failed++;
  }

  // Test 6: Test storage usage calculation
  console.log('\n6️⃣ Testing storage usage calculation...');
  try {
    const usage = await window.hybridStorage.getStorageUsage();
    if (usage && usage.local) {
      console.log(`   Used: ${usage.local.usedFormatted}`);
      console.log(`   Quota: ${usage.local.quotaFormatted}`);
      console.log(`   Percent: ${usage.local.percentUsed}%`);
      console.log('✅ Storage usage calculation working');
      tests.push({ name: 'Storage Usage', passed: true });
      passed++;
    } else {
      throw new Error('Failed to get storage usage');
    }
  } catch (error) {
    console.log('❌ Storage usage calculation failed:', error.message);
    tests.push({ name: 'Storage Usage', passed: false });
    failed++;
  }

  // Test 7: Performance benchmark for large sprite
  console.log('\n7️⃣ Performance benchmark (512x512 sprite)...');
  try {
    const perfSprite = new Sprite(512, 512, 'Performance Test');
    
    // Save benchmark
    const saveTimes = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await window.canvasStorageManager.saveSprite(perfSprite);
      saveTimes.push(performance.now() - start);
    }
    
    // Load benchmark
    const loadTimes = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await window.canvasStorageManager.loadSprite(perfSprite.id);
      loadTimes.push(performance.now() - start);
    }
    
    const avgSave = (saveTimes.reduce((a, b) => a + b) / saveTimes.length).toFixed(2);
    const avgLoad = (loadTimes.reduce((a, b) => a + b) / loadTimes.length).toFixed(2);
    
    console.log(`   Average save time: ${avgSave}ms`);
    console.log(`   Average load time: ${avgLoad}ms`);
    console.log('✅ Performance benchmark completed');
    tests.push({ name: 'Performance Benchmark', passed: true });
    passed++;
    
    // Cleanup
    await window.canvasStorageManager.deleteSprite(perfSprite.id);
  } catch (error) {
    console.log('❌ Performance benchmark failed:', error.message);
    tests.push({ name: 'Performance Benchmark', passed: false });
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  tests.forEach(test => {
    const icon = test.passed === true ? '✅' : test.passed === false ? '❌' : '⚠️';
    const status = test.passed === true ? 'PASSED' : test.passed === false ? 'FAILED' : 'SKIPPED';
    console.log(`${icon} ${test.name}: ${status}`);
  });
  
  console.log('\n' + '-'.repeat(50));
  console.log(`Total: ${tests.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${tests.length - passed - failed}`);
  console.log('-'.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Storage system is working correctly.');
  } else {
    console.log(`\n⚠️ ${failed} test(s) failed. Please check the errors above.`);
  }
  
  return {
    total: tests.length,
    passed,
    failed,
    skipped: tests.length - passed - failed,
    tests
  };
}

// Auto-run if in test mode
if (window.location.search.includes('test=storage')) {
  window.addEventListener('load', () => {
    setTimeout(() => testStorageSystem(), 1000);
  });
}

// Make available globally
window.testStorageSystem = testStorageSystem;

console.log('✅ Storage test script loaded. Run: testStorageSystem()');
