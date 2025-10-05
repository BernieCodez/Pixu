// Diagnostic Script - Verify Storage System
// Run this in browser console to check if the fix is working

console.log('=== PIXALU STORAGE DIAGNOSTIC ===\n');

// 1. Check which storage system is active
if (window.editor && window.editor.storageManager) {
  const storageType = window.editor.storageManager.constructor.name;
  console.log('✓ Storage System:', storageType);
  
  if (storageType === 'HybridStorageManager') {
    console.log('  ✅ GOOD: Using new hybrid storage system');
  } else if (storageType === 'StorageManager') {
    console.log('  ❌ BAD: Using legacy storage system');
    console.log('  → Fix: Check console for initialization errors');
    console.log('  → The constructor might be assigning the wrong storage');
  }
  
  // Show what's available globally
  console.log('\n  Global storage objects:');
  console.log('    window.hybridStorage:', window.hybridStorage ? '✓' : '✗');
  console.log('    window.storageManager:', window.storageManager ? '✓' : '✗');
  console.log('    editor.storageManager:', window.editor.storageManager.constructor.name);
} else {
  console.log('❌ No storage manager found');
}

// 2. Check database name
if (window.editor && window.editor.storageManager && window.editor.storageManager.localStorage) {
  const dbName = window.editor.storageManager.localStorage.dbName;
  console.log('\n✓ Database Name:', dbName);
  
  if (dbName === 'PixelEditorDB_v3') {
    console.log('  ✅ GOOD: Using new database (v3)');
  } else {
    console.log('  ❌ BAD: Using old database');
    console.log('  → Fix: Clear cache and reload');
  }
}

// 3. Check current sprites
if (window.editor && window.editor.sprites) {
  const spriteCount = window.editor.sprites.length;
  console.log('\n✓ Loaded Sprites:', spriteCount);
  
  if (spriteCount > 0) {
    console.log('  ✅ GOOD: Sprites are loaded');
    window.editor.sprites.forEach((sprite, index) => {
      console.log(`    ${index + 1}. ${sprite.name} (${sprite.width}x${sprite.height}) - Modified: ${new Date(sprite.modifiedAt).toLocaleString()}`);
    });
  } else {
    console.log('  ⚠️ No sprites found (create some to test)');
  }
}

// 4. Check cloud storage
if (window.hybridStorage && window.hybridStorage.cloudStorage) {
  const cloudInitialized = window.hybridStorage.cloudStorage.initialized;
  console.log('\n✓ Cloud Storage:', cloudInitialized ? 'Initialized' : 'Not initialized');
  
  if (window.currentUser) {
    console.log('  ✅ User logged in:', window.currentUser.email);
    console.log('  → Sprites will sync to cloud');
  } else {
    console.log('  ⚠️ User not logged in');
    console.log('  → Sprites saved locally only');
  }
}

// 5. Check for helper method
if (window.editor && typeof window.editor.saveSpriteWithSync === 'function') {
  console.log('\n✓ saveSpriteWithSync:', 'Available ✅');
} else {
  console.log('\n✗ saveSpriteWithSync:', 'Missing ❌');
  console.log('  → Fix: Reload page');
}

// 6. Quick functional test
console.log('\n=== FUNCTIONAL TEST ===');
console.log('Run these commands to test:');
console.log('\n// 1. Create a test sprite:');
console.log('window.editor.createNewSprite(16, 16, "Test Sprite");');
console.log('\n// 2. Check it saved:');
console.log('window.editor.sprites.length // Should increase by 1');
console.log('\n// 3. Reload page and run diagnostic again');
console.log('// All sprites should still be there!');

console.log('\n=== END DIAGNOSTIC ===\n');

// Return summary object
({
  storageSystem: window.editor?.storageManager?.constructor?.name || 'Unknown',
  database: window.editor?.storageManager?.localStorage?.dbName || 'Unknown',
  spriteCount: window.editor?.sprites?.length || 0,
  cloudEnabled: window.hybridStorage?.cloudStorage?.initialized || false,
  userLoggedIn: !!window.currentUser,
  helperMethodExists: typeof window.editor?.saveSpriteWithSync === 'function'
});
