#!/usr/bin/env python3
"""
Test script for waitlist functionality
Tests: get_customer_waitlist, leave_waitlist, release_lock
"""

import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

# Add backend to path
sys.path.insert(0, '/Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend')

from config.database import SessionLocal, Base, engine
from models import (
    User, ServiceProvider, WaitlistEntry, Appointment, ServiceOffering
)
from services.customer_booking_service import (
    get_customer_waitlist,
    leave_waitlist,
    release_lock
)


def setup_test_data(db: Session):
    """Create test data for waitlist testing"""
    
    # Create test users
    customer1 = User(
        id="cust_1",
        email="customer1@test.com",
        full_name="Customer One",
        phone="+1234567890",
        role="customer",
        password_hash="dummy_hash",
        is_active=True
    )
    
    customer2 = User(
        id="cust_2",
        email="customer2@test.com",
        full_name="Customer Two",
        phone="+1234567891",
        role="customer",
        password_hash="dummy_hash",
        is_active=True
    )
    
    provider_user = User(
        id="prov_user_1",
        email="provider@test.com",
        full_name="Dr. Provider",
        phone="+1234567892",
        role="provider",
        password_hash="dummy_hash",
        is_active=True
    )
    
    provider = ServiceProvider(
        id="prov_1",
        user_id="prov_user_1",
        specialization="General Practice",
        consultation_fee=100.0,
        is_verified=True
    )
    
    # Add and commit users and provider first (before waitlist entries)
    db.add_all([customer1, customer2, provider_user, provider])
    db.commit()
    print("✓ Created users and provider")
    
    # Create waitlist entries after provider is committed
    entry1 = WaitlistEntry(
        id="wl_1",
        customer_id="cust_1",
        provider_id="prov_1",
        status="waiting",
        preferred_date=datetime.now().date() + timedelta(days=2)
    )
    
    entry2 = WaitlistEntry(
        id="wl_2",
        customer_id="cust_2",
        provider_id="prov_1",
        status="waiting",
        preferred_date=datetime.now().date() + timedelta(days=2)
    )
    
    # Add and commit waitlist entries
    db.add_all([entry1, entry2])
    db.commit()
    print("✓ Created waitlist entries")
    
    return {
        "customer1_id": "cust_1",
        "customer2_id": "cust_2",
        "provider_id": "prov_1",
        "entry1_id": "wl_1",
        "entry2_id": "wl_2"
    }


def test_get_customer_waitlist(db: Session, test_data: dict):
    """Test retrieving customer's waitlist"""
    print("\n📋 Test: Get Customer Waitlist")
    
    try:
        customer_id = test_data["customer1_id"]
        waitlist = get_customer_waitlist(db, customer_id)
        
        print(f"✓ Retrieved {len(waitlist)} waitlist entries for {customer_id}")
        for entry in waitlist:
            print(f"  - Entry {entry['id']}: {entry['status']} with {entry['provider_name']}")
        
        return True
    except Exception as e:
        print(f"✗ Failed: {str(e)}")
        return False


def test_leave_waitlist(db: Session, test_data: dict):
    """Test leaving a waitlist"""
    print("\n🚪 Test: Leave Waitlist")
    
    try:
        customer_id = test_data["customer1_id"]
        entry_id = test_data["entry1_id"]
        
        # Leave waitlist
        result = leave_waitlist(db, customer_id, entry_id)
        print(f"✓ Left waitlist: {result}")
        
        # Verify status changed
        entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
        assert entry.status == "cancelled", f"Expected 'cancelled' but got '{entry.status}'"
        print(f"✓ Status verified as 'cancelled'")
        
        return True
    except Exception as e:
        print(f"✗ Failed: {str(e)}")
        return False


def test_release_lock(db: Session, test_data: dict):
    """Test releasing a lock to next customer"""
    print("\n🔓 Test: Release Lock")
    
    try:
        # First, set entry1 to "notified" to simulate open lock
        entry1 = db.query(WaitlistEntry).filter(WaitlistEntry.id == test_data["entry1_id"]).first()
        entry1.status = "notified"
        db.commit()
        print(f"✓ Set entry1 to 'notified' state")
        
        # Release lock
        customer_id = test_data["customer1_id"]
        entry_id = test_data["entry1_id"]
        
        result = release_lock(db, customer_id, entry_id)
        print(f"✓ Released lock: {result}")
        
        # Verify current entry is fulfilled
        entry1_check = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
        assert entry1_check.status == "fulfilled", f"Expected 'fulfilled' but got '{entry1_check.status}'"
        print(f"✓ Current entry status: 'fulfilled'")
        
        # Verify next customer was notified
        entry2 = db.query(WaitlistEntry).filter(WaitlistEntry.id == test_data["entry2_id"]).first()
        assert entry2.status == "notified", f"Expected 'notified' but got '{entry2.status}'"
        print(f"✓ Next entry status: 'notified'")
        print(f"✓ Claim expires at: {entry2.claim_expires_at}")
        
        return True
    except Exception as e:
        print(f"✗ Failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("🧪 WAITLIST FUNCTIONALITY TESTS")
    print("=" * 60)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Setup test data
        print("\n📝 Setting up test data...")
        test_data = setup_test_data(db)
        print("✓ Test data created successfully")
        
        # Run tests
        results = {
            "get_customer_waitlist": test_get_customer_waitlist(db, test_data),
            "leave_waitlist": test_leave_waitlist(db, test_data),
            "release_lock": test_release_lock(db, test_data),
        }
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, passed_flag in results.items():
            status = "✓ PASS" if passed_flag else "✗ FAIL"
            print(f"{status}: {test_name}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print("\n🎉 All tests passed!")
            return 0
        else:
            print(f"\n⚠️  {total - passed} test(s) failed")
            return 1
            
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
