#!/bin/bash

# Pixalu Storage System Setup Script

echo "🎨 Pixalu Storage System Setup"
echo "================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found"
    echo "📦 Install it with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase..."
    firebase login
fi

echo ""
echo "📋 Current Firebase projects:"
firebase projects:list

echo ""
echo "🔧 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Firestore rules deployed successfully!"
    echo ""
    echo "📊 Storage System Information:"
    echo "   - Local Storage: Canvas-based IndexedDB"
    echo "   - Cloud Storage: Firebase Firestore"
    echo "   - Max Image Size: 1920x1080 (and beyond)"
    echo "   - Auto-sync: Enabled by default"
    echo ""
    echo "🚀 Your editor is now ready to handle large pixel art!"
    echo ""
    echo "📖 For more information, see STORAGE_IMPLEMENTATION.md"
else
    echo ""
    echo "❌ Failed to deploy Firestore rules"
    echo "   Please check your Firebase configuration"
    exit 1
fi
