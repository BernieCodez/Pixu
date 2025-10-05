#!/bin/bash

# Firestore Setup and Troubleshooting Guide

echo "🔥 Firebase Firestore Setup"
echo "============================"
echo ""

# Check if Firestore is enabled
echo "📋 Checking Firestore status..."
echo ""
echo "1. Open Firebase Console: https://console.firebase.google.com/project/pixaluapp/firestore"
echo ""
echo "2. If you see 'Create database' button:"
echo "   ✅ Click 'Create database'"
echo "   ✅ Select 'Start in production mode' (rules are already deployed)"
echo "   ✅ Choose a location (us-central1 recommended)"
echo "   ✅ Click 'Enable'"
echo ""
echo "3. If database already exists:"
echo "   ✅ Rules are already deployed ✓"
echo "   ✅ Check Rules tab to verify"
echo ""
echo "4. Test the connection:"
echo "   ✅ Open your editor in browser"
echo "   ✅ Open browser console"
echo "   ✅ Run: testStorageSystem()"
echo ""
echo "5. If still getting permission errors:"
echo "   ✅ Check that you're signed in: window.currentUser"
echo "   ✅ Verify user ID matches Firestore rules"
echo "   ✅ Check Firebase Console > Firestore > Rules tab"
echo ""

# Deploy rules again to be sure
echo "🚀 Deploying Firestore rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Firestore rules deployed successfully!"
    echo ""
    echo "📊 Next steps:"
    echo "   1. Enable Firestore database in Firebase Console (if not already enabled)"
    echo "   2. Sign in to your app"
    echo "   3. Run testStorageSystem() in browser console"
    echo ""
    echo "🔗 Firebase Console: https://console.firebase.google.com/project/pixaluapp/firestore"
else
    echo ""
    echo "❌ Failed to deploy Firestore rules"
    exit 1
fi
