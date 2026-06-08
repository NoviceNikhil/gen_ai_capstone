#!/usr/bin/env python3
"""
Diagnose provider login issues - check if provider accounts are set up correctly.
"""

import sys
import os
sys.path.insert(0, '/Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend')

from config.database import SessionLocal
from models import User, ServiceProvider
from utils.security import verify_password

db = SessionLocal()

try:
    # Get all provider users
    providers = db.query(User).filter(User.role == "provider").all()
    
    if not providers:
        print("❌ No provider users found in database!")
        sys.exit(1)
    
    print(f"\n✅ Found {len(providers)} provider users\n")
    print("=" * 80)
    print("PROVIDER LOGIN DIAGNOSTIC")
    print("=" * 80)
    
    for i, provider_user in enumerate(providers[:5], 1):  # Show first 5
        print(f"\n{i}. {provider_user.full_name}")
        print(f"   Email: {provider_user.email}")
        print(f"   Is Active: {provider_user.is_active}")
        print(f"   Password Hash Exists: {bool(provider_user.password_hash)}")
        print(f"   Auth Provider: {provider_user.auth_provider}")
        
        # Try to verify password
        test_password = "Provider123"
        if provider_user.password_hash:
            password_matches = verify_password(test_password, provider_user.password_hash)
            print(f"   Password '{test_password}' matches: {password_matches}")
        
        # Check if provider profile exists
        profile = db.query(ServiceProvider).filter(ServiceProvider.user_id == provider_user.id).first()
        if profile:
            print(f"   Provider Profile: ✅ (ID: {profile.id})")
            print(f"   Specialization: {profile.specialization}")
            print(f"   Is Verified: {profile.is_verified}")
        else:
            print(f"   Provider Profile: ❌ NOT FOUND")
    
    print("\n" + "=" * 80)
    print("QUICK TEST: Try logging in with:")
    print("Email: aisha.mehta.provider@app-demo.com")
    print("Password: Provider123")
    print("=" * 80 + "\n")
    
finally:
    db.close()
