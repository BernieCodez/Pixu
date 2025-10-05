// Hybrid Storage Manager - Combines local canvas storage with cloud sync
class HybridStorageManager {
  constructor() {
    this.localStorage = window.canvasStorageManager;
    this.cloudStorage = window.cloudStorage;
    this.autoSyncEnabled = true;
    this.syncInterval = 30000; // Sync every 30 seconds
    this.syncTimer = null;
    this.pendingSync = new Set();
    this.isSyncing = false;
  }

  async initialize(firebaseApp) {
    try {
      // Initialize cloud storage
      if (firebaseApp && this.cloudStorage) {
        await this.cloudStorage.initialize(firebaseApp);
        console.log('Hybrid storage initialized with cloud sync');
        
        // Start auto-sync
        if (this.autoSyncEnabled) {
          this.startAutoSync();
        }
      } else {
        console.log('Hybrid storage initialized (local only)');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize hybrid storage:', error);
      return false;
    }
  }

  async saveSprite(sprite, options = {}) {
    const { syncToCloud = true, userId = null } = options;
    
    try {
      // Validate sprite data
      if (!sprite || !sprite.id || !sprite.frames || sprite.frames.length === 0) {
        console.warn('Invalid sprite data, initializing frames...');
        if (sprite && sprite.initializeFrames) {
          sprite.initializeFrames();
        } else {
          throw new Error('Cannot save invalid sprite');
        }
      }

      // Always save locally first (fast)
      const localSuccess = await this.localStorage.saveSprite(sprite);
      
      if (!localSuccess) {
        console.error('Local save failed for sprite:', sprite.name);
        throw new Error('Failed to save sprite locally');
      }

      // Sync to cloud if enabled and user is logged in
      if (syncToCloud && userId && this.cloudStorage && this.cloudStorage.initialized) {
        // Don't wait for cloud sync - do it in background
        this.pendingSync.add(sprite.id);
        this.syncSpriteToCloud(sprite, userId).catch(err => {
          console.warn('Background cloud sync failed (will retry later):', err.message);
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to save sprite:', error);
      return false;
    }
  }

  async syncSpriteToCloud(sprite, userId) {
    if (!userId || !this.cloudStorage || !this.cloudStorage.initialized) {
      return false;
    }

    try {
      const success = await this.cloudStorage.saveSprite(sprite, userId);
      if (success) {
        this.pendingSync.delete(sprite.id);
        console.log(`Synced sprite ${sprite.name} to cloud`);
      }
      return success;
    } catch (error) {
      console.error('Failed to sync sprite to cloud:', error);
      return false;
    }
  }

  async saveSprites(sprites, options = {}) {
    const { syncToCloud = true, userId = null } = options;

    try {
      // Save all locally
      const localSuccess = await this.localStorage.saveSprites(sprites);
      
      if (!localSuccess) {
        throw new Error('Failed to save sprites locally');
      }

      // Queue cloud sync
      if (syncToCloud && userId && this.cloudStorage && this.cloudStorage.initialized) {
        sprites.forEach(sprite => this.pendingSync.add(sprite.id));
        
        // Sync in background
        this.syncAllToCloud(sprites, userId).catch(err => {
          console.error('Background cloud sync failed:', err);
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to save sprites:', error);
      return false;
    }
  }

  async syncAllToCloud(sprites, userId) {
    if (!userId || !this.cloudStorage || !this.cloudStorage.initialized) {
      return false;
    }

    this.isSyncing = true;

    try {
      for (const sprite of sprites) {
        await this.syncSpriteToCloud(sprite, userId);
        // Rate limiting to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`Synced ${sprites.length} sprites to cloud`);
      return true;
    } catch (error) {
      console.error('Failed to sync sprites to cloud:', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  async loadSprite(spriteId, options = {}) {
    const { preferCloud = false, userId = null } = options;

    try {
      // Try local first (faster)
      const localSprite = await this.localStorage.loadSprite(spriteId);

      // If we prefer cloud and user is logged in, check cloud version
      if (preferCloud && userId && this.cloudStorage && this.cloudStorage.initialized) {
        try {
          const cloudSprite = await this.cloudStorage.loadSprite(spriteId, userId);
          
          if (cloudSprite) {
            // Compare timestamps and use newer version
            if (!localSprite || 
                new Date(cloudSprite.modifiedAt) > new Date(localSprite.modifiedAt)) {
              // Save cloud version locally for offline access
              await this.localStorage.saveSprite(cloudSprite);
              return cloudSprite;
            }
          }
        } catch (error) {
          console.warn('Failed to load from cloud, using local version:', error);
        }
      }

      return localSprite;
    } catch (error) {
      console.error('Failed to load sprite:', error);
      return null;
    }
  }

  async loadSprites(options = {}) {
    const { preferCloud = false, userId = null } = options;

    try {
      // Always load local sprites (fast)
      const localSprites = await this.localStorage.loadSprites();
      console.log(`Loaded ${localSprites.length} sprites from local storage`);

      // If cloud is available, merge with cloud sprites
      if (preferCloud && userId && this.cloudStorage && this.cloudStorage.initialized) {
        try {
          const cloudSprites = await this.cloudStorage.loadAllSprites(userId);
          console.log(`Loaded ${cloudSprites.length} sprites from cloud`);
          
          // Merge: prefer cloud versions if they're newer
          const spriteMap = new Map();
          
          // Add local sprites
          localSprites.forEach(sprite => {
            spriteMap.set(sprite.id, sprite);
          });

          // Update with cloud sprites if newer
          for (const cloudSprite of cloudSprites) {
            const localSprite = spriteMap.get(cloudSprite.id);
            const cloudTime = new Date(cloudSprite.modifiedAt);
            const localTime = localSprite ? new Date(localSprite.modifiedAt) : null;

            if (!localSprite) {
              console.log(`[MERGE] Sprite ${cloudSprite.name} (${cloudSprite.id}) only in cloud, using cloud version.`);
              spriteMap.set(cloudSprite.id, cloudSprite);
              this.localStorage.saveSprite(cloudSprite).catch(err => {
                console.error('Failed to save cloud sprite locally:', err);
              });
            } else if (cloudTime > localTime) {
              console.log(`[MERGE] Sprite ${cloudSprite.name} (${cloudSprite.id}) cloud version newer (${cloudTime} > ${localTime}), using cloud.`);
              spriteMap.set(cloudSprite.id, cloudSprite);
              this.localStorage.saveSprite(cloudSprite).catch(err => {
                console.error('Failed to save cloud sprite locally:', err);
              });
            } else {
              console.log(`[MERGE] Sprite ${cloudSprite.name} (${cloudSprite.id}) local version newer (${localTime} >= ${cloudTime}), keeping local.`);
            }
          }

          const mergedSprites = Array.from(spriteMap.values());
          console.log(`Merged result: ${mergedSprites.length} total sprites`);
          return mergedSprites;
        } catch (error) {
          console.warn('Failed to load from cloud, using local sprites:', error);
        }
      }

      return localSprites;
    } catch (error) {
      console.error('Failed to load sprites:', error);
      return [];
    }
  }

  async deleteSprite(spriteId, options = {}) {
    const { deleteFromCloud = true, userId = null } = options;

    try {
      // Delete locally
      const localSuccess = await this.localStorage.deleteSprite(spriteId);

      // Delete from cloud
      if (deleteFromCloud && userId && this.cloudStorage && this.cloudStorage.initialized) {
        await this.cloudStorage.deleteSprite(spriteId, userId);
      }

      this.pendingSync.delete(spriteId);
      return localSuccess;
    } catch (error) {
      console.error('Failed to delete sprite:', error);
      return false;
    }
  }

  async clearSprites(options = {}) {
    const { clearCloud = false, userId = null } = options;

    try {
      await this.localStorage.clearSprites();

      if (clearCloud && userId && this.cloudStorage && this.cloudStorage.initialized) {
        const cloudSprites = await this.cloudStorage.loadAllSprites(userId);
        for (const sprite of cloudSprites) {
          await this.cloudStorage.deleteSprite(sprite.id, userId);
        }
      }

      this.pendingSync.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear sprites:', error);
      return false;
    }
  }

  // Auto-sync management
  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (this.pendingSync.size > 0 && !this.isSyncing) {
        const user = window.currentUser;
        if (user && this.cloudStorage && this.cloudStorage.initialized) {
          console.log(`Auto-syncing ${this.pendingSync.size} sprites...`);
          
          const spriteIds = Array.from(this.pendingSync);
          for (const spriteId of spriteIds) {
            const sprite = await this.localStorage.loadSprite(spriteId);
            if (sprite) {
              await this.syncSpriteToCloud(sprite, user.uid);
            }
          }
        }
      }
    }, this.syncInterval);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  setAutoSync(enabled) {
    this.autoSyncEnabled = enabled;
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  // Sync status
  getSyncStatus() {
    return {
      pending: this.pendingSync.size,
      syncing: this.isSyncing,
      cloudAvailable: this.cloudStorage && this.cloudStorage.initialized,
      autoSyncEnabled: this.autoSyncEnabled
    };
  }

  // Force sync all pending
  async forceSyncAll() {
    const user = window.currentUser;
    if (!user) {
      console.warn('No user logged in, cannot sync');
      return false;
    }

    if (this.pendingSync.size === 0) {
      console.log('No sprites pending sync');
      return true;
    }

    this.isSyncing = true;

    try {
      const spriteIds = Array.from(this.pendingSync);
      console.log(`Force syncing ${spriteIds.length} sprites...`);

      for (const spriteId of spriteIds) {
        const sprite = await this.localStorage.loadSprite(spriteId);
        if (sprite) {
          await this.syncSpriteToCloud(sprite, user.uid);
        }
      }

      console.log('Force sync completed');
      return true;
    } catch (error) {
      console.error('Force sync failed:', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  // Settings methods (pass through to local storage)
  async saveSettings(settings) {
    return this.localStorage.saveSettings(settings);
  }

  async loadSettings() {
    return this.localStorage.loadSettings();
  }

  getDefaultSettings() {
    return this.localStorage.getDefaultSettings();
  }

  async getStorageUsage() {
    const local = await this.localStorage.getStorageUsage();
    
    return {
      local,
      cloudAvailable: this.cloudStorage && this.cloudStorage.initialized,
      pendingSync: this.pendingSync.size
    };
  }

  close() {
    this.stopAutoSync();
    if (this.localStorage && typeof this.localStorage.close === 'function') {
      this.localStorage.close();
    }
  }
}

// Global instance - create immediately with dependency checking
(function() {
  if (!window.canvasStorageManager) {
    console.error('❌ Cannot create hybridStorage: canvasStorageManager not found!');
    console.error('   Make sure canvasStorage.js is loaded before hybridStorage.js');
    return;
  }
  
  if (!window.cloudStorage) {
    console.error('❌ Cannot create hybridStorage: cloudStorage not found!');
    console.error('   Make sure cloudStorage.js is loaded before hybridStorage.js');
    return;
  }
  
  window.hybridStorage = new HybridStorageManager();
  console.log('✓ HybridStorageManager created successfully');
})();

// Replace old storage manager for backward compatibility
window.storageManager = window.hybridStorage;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridStorageManager;
}
