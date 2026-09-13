#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Ownership Transfer Feature + Bug Fix Verification
Tests the new ownership transfer flow and verifies the public profile bug fix
"""

import requests
import json
import time
from datetime import datetime, timedelta
import random
import string

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def generate_unique_email():
    """Generate a unique email for testing"""
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase, k=6))
    return f"test_{timestamp}_{random_str}@motodna.test"

def test_public_profile_bug_fix():
    """Test 1: Verify public profile endpoint returns valid JSON with all fields"""
    
    log("=" * 80)
    log("TEST 1: BUG FIX VERIFICATION - Public Profile Endpoint")
    log("=" * 80)
    
    try:
        # Register a user and get their demo bike
        log("\n1.1. Registering user to get demo bike...")
        session = requests.Session()
        email = generate_unique_email()
        password = "test123"
        
        register_data = {
            "email": email,
            "password": password,
            "first_name": "BugFix",
            "last_name": "Test"
        }
        
        resp = session.post(f"{BASE_URL}/auth/register", json=register_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: Register failed: {resp.status_code} - {resp.text}")
            return False
        
        log(f"✅ User registered: {email}")
        
        # Get dashboard to find demo bike
        log("\n1.2. Getting demo bike from dashboard...")
        resp = session.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: Dashboard failed: {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if not data.get('motos') or len(data['motos']) == 0:
            log(f"❌ FAILED: No motorcycles found")
            return False
        
        motorcycle_id = data['motos'][0]['id']
        public_id = data['motos'][0]['public_id']
        log(f"✅ Found demo bike: {public_id}")
        
        # Add some maintenance with cost/currency to test stripping
        log("\n1.3. Adding maintenance with cost/currency...")
        maint_data = {
            "service_type": "OIL_CHANGE",
            "title": "Test Maintenance",
            "description": "Testing cost stripping",
            "date": datetime.now().isoformat(),
            "mileage": 15000,
            "cost": 150.50,
            "currency": "EUR",
            "is_public": True
        }
        resp = session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance", json=maint_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: Maintenance creation failed: {resp.status_code}")
            return False
        
        maint_id = resp.json().get('item', {}).get('id')
        log(f"✅ Maintenance added: {maint_id}")
        
        # Add a post-it to test postits array
        log("\n1.4. Adding a post-it...")
        postit_data = {
            "author_name": "Test User",
            "message": "Testing postits array in public profile"
        }
        
        # Use a new session without auth for post-it
        public_session = requests.Session()
        resp = public_session.post(f"{BASE_URL}/public/{public_id}/postit", json=postit_data)
        if resp.status_code != 201:
            log(f"❌ FAILED: Post-it creation failed: {resp.status_code}")
            return False
        
        log(f"✅ Post-it added")
        
        # TEST: GET public profile without auth
        log("\n1.5. Testing GET /api/public/{public_id} WITHOUT auth...")
        resp = public_session.get(f"{BASE_URL}/public/{public_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ Public profile endpoint returned 200")
        
        # Verify response structure
        try:
            profile_data = resp.json()
        except Exception as e:
            log(f"❌ FAILED: Response is not valid JSON: {e}")
            return False
        
        log(f"✅ Response is valid JSON")
        
        # Check all required fields
        required_fields = ['moto', 'owner', 'maintenance', 'timeline', 'modifications', 'gallery', 'postits', 'scan_count']
        missing_fields = []
        
        for field in required_fields:
            if field not in profile_data:
                missing_fields.append(field)
        
        if missing_fields:
            log(f"❌ FAILED: Missing required fields: {missing_fields}")
            return False
        
        log(f"✅ All required fields present: {required_fields}")
        
        # Verify postits is an array
        if not isinstance(profile_data['postits'], list):
            log(f"❌ FAILED: postits is not an array: {type(profile_data['postits'])}")
            return False
        
        log(f"✅ postits is an array with {len(profile_data['postits'])} items")
        
        # Verify maintenance items have cost/currency stripped
        maintenance_items = profile_data.get('maintenance', [])
        if len(maintenance_items) > 0:
            for item in maintenance_items:
                if 'cost' in item or 'currency' in item:
                    log(f"❌ FAILED: cost/currency not stripped from maintenance item: {item}")
                    return False
            
            log(f"✅ cost/currency correctly stripped from {len(maintenance_items)} maintenance items")
        else:
            log(f"⚠️  No maintenance items to verify cost stripping")
        
        # Verify scan_count increments
        scan_count_1 = profile_data.get('scan_count', 0)
        log(f"   First scan_count: {scan_count_1}")
        
        # Get again to verify increment
        resp = public_session.get(f"{BASE_URL}/public/{public_id}")
        profile_data_2 = resp.json()
        scan_count_2 = profile_data_2.get('scan_count', 0)
        log(f"   Second scan_count: {scan_count_2}")
        
        if scan_count_2 != scan_count_1 + 1:
            log(f"❌ FAILED: scan_count did not increment correctly: {scan_count_1} -> {scan_count_2}")
            return False
        
        log(f"✅ scan_count increments correctly: {scan_count_1} -> {scan_count_2}")
        
        log("\n" + "=" * 80)
        log("✅ TEST 1 PASSED: Public profile bug fix verified")
        log("   - Returns valid JSON with all required fields")
        log("   - postits array present (even if empty)")
        log("   - cost/currency stripped from maintenance")
        log("   - scan_count increments correctly")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST 1 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_ownership_transfer_flow():
    """Test 2: Full ownership transfer flow"""
    
    log("\n" + "=" * 80)
    log("TEST 2: OWNERSHIP TRANSFER - Full Flow")
    log("=" * 80)
    
    try:
        # Step 2a: Register user A
        log("\n2a. Registering User A...")
        session_a = requests.Session()
        email_a = generate_unique_email()
        password_a = "test123"
        
        register_data_a = {
            "email": email_a,
            "password": password_a,
            "first_name": "UserA",
            "last_name": "Owner"
        }
        
        resp = session_a.post(f"{BASE_URL}/auth/register", json=register_data_a)
        if resp.status_code != 200:
            log(f"❌ FAILED: User A registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_a_data = resp.json()
        user_a_id = user_a_data['user']['id']
        log(f"✅ User A registered: {email_a}")
        log(f"   User A ID: {user_a_id}")
        
        # Get User A's demo motorcycle
        log("\n2b. Getting User A's motorcycle from dashboard...")
        resp = session_a.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: Dashboard failed: {resp.status_code}")
            return False
        
        dashboard_data = resp.json()
        if not dashboard_data.get('motos') or len(dashboard_data['motos']) == 0:
            log(f"❌ FAILED: No motorcycles found for User A")
            return False
        
        motorcycle_id = dashboard_data['motos'][0]['id']
        public_id = dashboard_data['motos'][0]['public_id']
        log(f"✅ User A's motorcycle: {motorcycle_id}")
        log(f"   Public ID: {public_id}")
        log(f"   Brand/Model: {dashboard_data['motos'][0].get('brand')} {dashboard_data['motos'][0].get('model')}")
        
        # Step 2c: POST /api/motorcycles/:id/transfer as User A
        log("\n2c. Creating transfer as User A...")
        resp = session_a.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer", json={})
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer creation failed: {resp.status_code} - {resp.text}")
            return False
        
        transfer_data = resp.json()
        transfer = transfer_data.get('transfer')
        
        if not transfer:
            log(f"❌ FAILED: No transfer object in response")
            return False
        
        transfer_code = transfer.get('code')
        expires_at = transfer.get('expires_at')
        
        if not transfer_code:
            log(f"❌ FAILED: No transfer code in response")
            return False
        
        # Verify code is ~8 chars
        if len(transfer_code) < 6 or len(transfer_code) > 10:
            log(f"❌ FAILED: Transfer code length unexpected: {len(transfer_code)} chars")
            return False
        
        log(f"✅ Transfer created successfully")
        log(f"   Code: {transfer_code}")
        log(f"   Expires at: {expires_at}")
        log(f"   Status: {transfer.get('status')}")
        
        # Verify expires_at is ~7 days in future
        if expires_at:
            try:
                expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                now = datetime.now(expires_dt.tzinfo)
                days_diff = (expires_dt - now).days
                
                if days_diff < 6 or days_diff > 8:
                    log(f"⚠️  WARNING: Expiry not ~7 days: {days_diff} days")
                else:
                    log(f"✅ Expiry is ~7 days in future: {days_diff} days")
            except Exception as e:
                log(f"⚠️  WARNING: Could not parse expires_at: {e}")
        
        # Step 2d: GET /api/motorcycles/:id/transfer as User A
        log("\n2d. Getting current transfer as User A...")
        resp = session_a.get(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Get transfer failed: {resp.status_code} - {resp.text}")
            return False
        
        get_transfer_data = resp.json()
        get_transfer = get_transfer_data.get('transfer')
        
        if not get_transfer:
            log(f"❌ FAILED: No transfer in response")
            return False
        
        if get_transfer.get('code') != transfer_code:
            log(f"❌ FAILED: Transfer code mismatch: {get_transfer.get('code')} != {transfer_code}")
            return False
        
        log(f"✅ GET transfer returns same pending transfer")
        log(f"   Code: {get_transfer.get('code')}")
        
        # Step 2e: GET /api/transfer/:code as User A (preview)
        log("\n2e. Getting transfer preview as User A...")
        resp = session_a.get(f"{BASE_URL}/transfer/{transfer_code}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer preview failed: {resp.status_code} - {resp.text}")
            return False
        
        preview_data = resp.json()
        preview_transfer = preview_data.get('transfer')
        preview_moto = preview_data.get('moto')
        
        if not preview_transfer or not preview_moto:
            log(f"❌ FAILED: Missing transfer or moto in preview")
            return False
        
        # Verify moto does NOT have owner_id
        if 'owner_id' in preview_moto:
            log(f"❌ FAILED: owner_id should be excluded from preview moto")
            return False
        
        log(f"✅ Transfer preview successful")
        log(f"   From user: {preview_transfer.get('from', {}).get('username')}")
        log(f"   Moto public_id: {preview_moto.get('public_id')}")
        log(f"   owner_id excluded: ✓")
        
        # Step 2f: POST /api/transfer/:code/accept as User A (should fail - can't transfer to self)
        log("\n2f. Attempting to accept own transfer as User A (should fail)...")
        resp = session_a.post(f"{BASE_URL}/transfer/{transfer_code}/accept", json={})
        
        if resp.status_code != 400:
            log(f"❌ FAILED: Expected 400, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        error_msg = resp.json().get('error', '')
        log(f"✅ Self-transfer correctly rejected with 400")
        log(f"   Error message: {error_msg}")
        
        # Step 2g: Register User B
        log("\n2g. Registering User B...")
        session_b = requests.Session()
        email_b = generate_unique_email()
        password_b = "test123"
        
        register_data_b = {
            "email": email_b,
            "password": password_b,
            "first_name": "UserB",
            "last_name": "Receiver"
        }
        
        resp = session_b.post(f"{BASE_URL}/auth/register", json=register_data_b)
        if resp.status_code != 200:
            log(f"❌ FAILED: User B registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_b_data = resp.json()
        user_b_id = user_b_data['user']['id']
        log(f"✅ User B registered: {email_b}")
        log(f"   User B ID: {user_b_id}")
        
        # Step 2h: GET /api/transfer/:code as User B (preview)
        log("\n2h. Getting transfer preview as User B...")
        resp = session_b.get(f"{BASE_URL}/transfer/{transfer_code}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer preview failed for User B: {resp.status_code} - {resp.text}")
            return False
        
        log(f"✅ User B can view transfer preview")
        
        # Step 2i: POST /api/transfer/:code/accept as User B (should succeed)
        log("\n2i. Accepting transfer as User B...")
        resp = session_b.post(f"{BASE_URL}/transfer/{transfer_code}/accept", json={})
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer acceptance failed: {resp.status_code} - {resp.text}")
            return False
        
        accept_data = resp.json()
        accepted_moto = accept_data.get('moto')
        
        if not accepted_moto:
            log(f"❌ FAILED: No moto in acceptance response")
            return False
        
        # Verify moto.owner_id is now User B's ID
        if accepted_moto.get('owner_id') != user_b_id:
            log(f"❌ FAILED: owner_id not updated to User B")
            log(f"   Expected: {user_b_id}")
            log(f"   Got: {accepted_moto.get('owner_id')}")
            return False
        
        log(f"✅ Transfer accepted successfully")
        log(f"   New owner_id: {accepted_moto.get('owner_id')}")
        log(f"   Matches User B: ✓")
        
        # Step 2j: GET /api/motorcycles/:id as User A (should fail - lost ownership)
        log("\n2j. Attempting to access motorcycle as User A (should fail)...")
        resp = session_a.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404, got {resp.status_code}")
            log(f"   User A should have lost access")
            return False
        
        log(f"✅ User A correctly lost access (404)")
        
        # Step 2k: GET /api/motorcycles/:id as User B (should succeed)
        log("\n2k. Accessing motorcycle as User B (new owner)...")
        resp = session_b.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: User B cannot access motorcycle: {resp.status_code} - {resp.text}")
            return False
        
        moto_data = resp.json()
        moto = moto_data.get('moto')
        
        if not moto:
            log(f"❌ FAILED: No moto in response")
            return False
        
        if moto.get('owner_id') != user_b_id:
            log(f"❌ FAILED: Moto owner_id mismatch")
            return False
        
        log(f"✅ User B successfully owns the motorcycle")
        log(f"   Moto ID: {moto.get('id')}")
        log(f"   Owner ID: {moto.get('owner_id')}")
        
        # Step 2l: POST /api/transfer/:code/accept again (should fail - already completed)
        log("\n2l. Attempting to accept completed transfer again...")
        resp = session_b.post(f"{BASE_URL}/transfer/{transfer_code}/accept", json={})
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404, got {resp.status_code}")
            log(f"   Completed transfer should not be reusable")
            return False
        
        log(f"✅ Completed transfer correctly rejected (404)")
        
        log("\n" + "=" * 80)
        log("✅ TEST 2 PASSED: Full ownership transfer flow working")
        log("   - Transfer creation with 8-char code")
        log("   - Transfer preview (moto without owner_id)")
        log("   - Self-transfer rejection (400)")
        log("   - Transfer acceptance updates owner_id")
        log("   - Previous owner loses access (404)")
        log("   - New owner gains access (200)")
        log("   - Completed transfer not reusable (404)")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST 2 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_transfer_edge_cases():
    """Test 3: Edge cases for ownership transfer"""
    
    log("\n" + "=" * 80)
    log("TEST 3: OWNERSHIP TRANSFER - Edge Cases")
    log("=" * 80)
    
    try:
        # Setup: Register User A and User B
        log("\n3.1. Setting up users...")
        session_a = requests.Session()
        email_a = generate_unique_email()
        
        resp = session_a.post(f"{BASE_URL}/auth/register", json={
            "email": email_a,
            "password": "test123",
            "first_name": "EdgeA",
            "last_name": "Test"
        })
        
        if resp.status_code != 200:
            log(f"❌ FAILED: User A registration failed")
            return False
        
        log(f"✅ User A registered: {email_a}")
        
        # Get User A's motorcycle
        resp = session_a.get(f"{BASE_URL}/dashboard")
        dashboard_data = resp.json()
        motorcycle_id = dashboard_data['motos'][0]['id']
        log(f"✅ User A's motorcycle: {motorcycle_id}")
        
        # Edge Case 1: GET /api/transfer/BOGUS12 (invalid code)
        log("\n3.2. Testing invalid transfer code...")
        resp = session_a.get(f"{BASE_URL}/transfer/BOGUS12")
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404 for invalid code, got {resp.status_code}")
            return False
        
        log(f"✅ Invalid transfer code correctly returns 404")
        
        # Edge Case 2: Create transfer as User A, then User B creates new transfer
        log("\n3.3. Creating transfer as User A...")
        resp = session_a.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer", json={})
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer creation failed")
            return False
        
        transfer_code_a = resp.json()['transfer']['code']
        log(f"✅ Transfer created by User A: {transfer_code_a}")
        
        # Register User B and accept the transfer
        log("\n3.4. Registering User B and accepting transfer...")
        session_b = requests.Session()
        email_b = generate_unique_email()
        
        resp = session_b.post(f"{BASE_URL}/auth/register", json={
            "email": email_b,
            "password": "test123",
            "first_name": "EdgeB",
            "last_name": "Test"
        })
        
        if resp.status_code != 200:
            log(f"❌ FAILED: User B registration failed")
            return False
        
        log(f"✅ User B registered: {email_b}")
        
        # User B accepts transfer
        resp = session_b.post(f"{BASE_URL}/transfer/{transfer_code_a}/accept", json={})
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer acceptance failed")
            return False
        
        log(f"✅ User B accepted transfer, now owns motorcycle")
        
        # Edge Case 3: User B creates new transfer
        log("\n3.5. User B creating new transfer...")
        resp = session_b.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer", json={})
        
        if resp.status_code != 200:
            log(f"❌ FAILED: User B cannot create transfer: {resp.status_code} - {resp.text}")
            return False
        
        transfer_code_b = resp.json()['transfer']['code']
        log(f"✅ User B created new transfer: {transfer_code_b}")
        
        # Edge Case 4: User A tries to GET transfer (should fail - not owner)
        log("\n3.6. User A attempting to GET transfer (should fail)...")
        resp = session_a.get(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer")
        
        if resp.status_code != 403:
            log(f"❌ FAILED: Expected 403, got {resp.status_code}")
            log(f"   User A should not have access")
            return False
        
        log(f"✅ User A correctly denied access (403)")
        
        # Edge Case 5: User B cancels transfer
        log("\n3.7. User B canceling transfer...")
        resp = session_b.delete(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Transfer cancellation failed: {resp.status_code} - {resp.text}")
            return False
        
        log(f"✅ Transfer cancelled successfully")
        
        # Edge Case 6: GET transfer should return null
        log("\n3.8. Verifying cancelled transfer returns null...")
        resp = session_b.get(f"{BASE_URL}/motorcycles/{motorcycle_id}/transfer")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: GET transfer failed: {resp.status_code}")
            return False
        
        transfer_data = resp.json()
        if transfer_data.get('transfer') is not None:
            log(f"❌ FAILED: Transfer should be null after cancellation")
            return False
        
        log(f"✅ Cancelled transfer correctly returns null")
        
        log("\n" + "=" * 80)
        log("✅ TEST 3 PASSED: All edge cases handled correctly")
        log("   - Invalid code returns 404")
        log("   - New owner can create transfer")
        log("   - Previous owner denied access (403)")
        log("   - Transfer cancellation works")
        log("   - Cancelled transfer returns null")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST 3 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_regression():
    """Test 4: Regression - verify existing endpoints still work"""
    
    log("\n" + "=" * 80)
    log("TEST 4: REGRESSION - Existing Endpoints")
    log("=" * 80)
    
    try:
        # Setup user
        log("\n4.1. Setting up test user...")
        session = requests.Session()
        email = generate_unique_email()
        
        resp = session.post(f"{BASE_URL}/auth/register", json={
            "email": email,
            "password": "test123",
            "first_name": "Regression",
            "last_name": "Test"
        })
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Registration failed")
            return False
        
        log(f"✅ User registered: {email}")
        
        # Get motorcycle
        resp = session.get(f"{BASE_URL}/dashboard")
        dashboard_data = resp.json()
        motorcycle_id = dashboard_data['motos'][0]['id']
        public_id = dashboard_data['motos'][0]['public_id']
        log(f"✅ Motorcycle: {motorcycle_id}")
        
        # Test 1: POST maintenance
        log("\n4.2. Testing POST maintenance...")
        maint_data = {
            "service_type": "OIL_CHANGE",
            "title": "Regression test maintenance",
            "description": "Testing after transfer feature",
            "date": datetime.now().isoformat(),
            "mileage": 25000,
            "cost": 100.00,
            "currency": "EUR",
            "is_public": True
        }
        
        resp = session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance", json=maint_data)
        
        if resp.status_code != 200:
            log(f"❌ FAILED: POST maintenance failed: {resp.status_code} - {resp.text}")
            return False
        
        maint_id = resp.json().get('item', {}).get('id')
        log(f"✅ POST maintenance successful: {maint_id}")
        
        # Test 2: POST upload
        log("\n4.3. Testing POST /api/uploads...")
        import base64
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        upload_data = {
            "data": f"data:image/png;base64,{tiny_png}",
            "filename": "regression_test.png"
        }
        
        resp = session.post(f"{BASE_URL}/uploads", json=upload_data)
        
        if resp.status_code != 201:
            log(f"❌ FAILED: POST upload failed: {resp.status_code} - {resp.text}")
            return False
        
        file_id = resp.json().get('id')
        log(f"✅ POST upload successful: {file_id}")
        
        # Test 3: POST post-it (no auth)
        log("\n4.4. Testing POST /api/public/{public_id}/postit...")
        public_session = requests.Session()
        
        postit_data = {
            "author_name": "Regression Tester",
            "message": "Testing post-it after transfer feature"
        }
        
        resp = public_session.post(f"{BASE_URL}/public/{public_id}/postit", json=postit_data)
        
        if resp.status_code != 201:
            log(f"❌ FAILED: POST post-it failed: {resp.status_code} - {resp.text}")
            return False
        
        postit_id = resp.json().get('postit', {}).get('id')
        log(f"✅ POST post-it successful: {postit_id}")
        
        # Test 4: POST NFC regenerate
        log("\n4.5. Testing POST /api/motorcycles/:id/nfc...")
        resp = session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/nfc", json={})
        
        if resp.status_code != 200:
            log(f"❌ FAILED: POST NFC failed: {resp.status_code} - {resp.text}")
            return False
        
        nfc_tag = resp.json().get('nfc', {}).get('tag_uid')
        log(f"✅ POST NFC successful: {nfc_tag}")
        
        # Clean up
        if maint_id:
            session.delete(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance/{maint_id}")
        
        log("\n" + "=" * 80)
        log("✅ TEST 4 PASSED: All regression tests successful")
        log("   - POST maintenance working")
        log("   - POST upload working")
        log("   - POST post-it working")
        log("   - POST NFC regenerate working")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST 4 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    log("=" * 80)
    log("MotoDNA Backend Tests - Ownership Transfer Feature + Bug Fix")
    log(f"Base URL: {BASE_URL}")
    log("=" * 80)
    
    all_passed = True
    
    # Test 1: Bug fix verification
    if not test_public_profile_bug_fix():
        all_passed = False
    
    # Test 2: Full ownership transfer flow
    if not test_ownership_transfer_flow():
        all_passed = False
    
    # Test 3: Edge cases
    if not test_transfer_edge_cases():
        all_passed = False
    
    # Test 4: Regression
    if not test_regression():
        all_passed = False
    
    # Final summary
    log("\n" + "=" * 80)
    if all_passed:
        log("🎉 ALL TESTS PASSED!")
        log("=" * 80)
        log("\nSUMMARY:")
        log("✅ TEST 1: Public profile bug fix verified")
        log("✅ TEST 2: Full ownership transfer flow working")
        log("✅ TEST 3: Edge cases handled correctly")
        log("✅ TEST 4: Regression tests passed")
        exit(0)
    else:
        log("❌ SOME TESTS FAILED")
        log("=" * 80)
        exit(1)
