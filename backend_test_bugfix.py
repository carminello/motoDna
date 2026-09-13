#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Bug Fix Verification
Tests the fix for dead /m/MDNA-DEMO link + resilient error handling
"""

import requests
import json
import time
import uuid
from datetime import datetime

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_public_profile_bugfix():
    """Test public profile endpoint bug fix and privacy checks"""
    
    log("=" * 80)
    log("TEST: Public Profile Bug Fix + Privacy Verification")
    log("=" * 80)
    
    session = requests.Session()
    unauth_session = requests.Session()
    
    try:
        # TEST 1: GET /api/public/MDNA-DEMO (non-existent placeholder) → 404 with JSON
        log("\n" + "=" * 80)
        log("TEST 1: GET /api/public/MDNA-DEMO (non-existent) → 404 with JSON")
        log("=" * 80)
        
        resp = unauth_session.get(f"{BASE_URL}/public/MDNA-DEMO")
        log(f"Status: {resp.status_code}")
        log(f"Response: {resp.text}")
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404, got {resp.status_code}")
            return False
        
        try:
            data = resp.json()
            if 'error' not in data:
                log(f"❌ FAILED: Response JSON missing 'error' field")
                return False
            if data['error'] != 'Moto non trovata':
                log(f"❌ FAILED: Expected error 'Moto non trovata', got '{data['error']}'")
                return False
            log(f"✅ PASSED: Returns 404 with JSON {{ error: 'Moto non trovata' }}")
        except json.JSONDecodeError:
            log(f"❌ FAILED: Response is not valid JSON")
            return False
        
        # TEST 2: GET /api/public/NON-EXISTENT-XYZ123 → 404 with same shape
        log("\n" + "=" * 80)
        log("TEST 2: GET /api/public/NON-EXISTENT-XYZ123 → 404 with JSON")
        log("=" * 80)
        
        resp = unauth_session.get(f"{BASE_URL}/public/NON-EXISTENT-XYZ123")
        log(f"Status: {resp.status_code}")
        log(f"Response: {resp.text}")
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404, got {resp.status_code}")
            return False
        
        try:
            data = resp.json()
            if 'error' not in data:
                log(f"❌ FAILED: Response JSON missing 'error' field")
                return False
            if data['error'] != 'Moto non trovata':
                log(f"❌ FAILED: Expected error 'Moto non trovata', got '{data['error']}'")
                return False
            log(f"✅ PASSED: Returns 404 with JSON {{ error: 'Moto non trovata' }}")
        except json.JSONDecodeError:
            log(f"❌ FAILED: Response is not valid JSON")
            return False
        
        # TEST 3: Setup - Register fresh user and get demo bike public_id
        log("\n" + "=" * 80)
        log("TEST 3: Setup - Register fresh user and get demo bike public_id")
        log("=" * 80)
        
        timestamp = int(time.time())
        email = f"testuser_{timestamp}@motodna.test"
        
        log(f"Registering user: {email}")
        register_data = {
            "email": email,
            "password": "SecurePass123!",
            "first_name": "Marco",
            "last_name": "Verdi",
            "username": f"marco_{timestamp}"
        }
        
        resp = session.post(f"{BASE_URL}/auth/register", json=register_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: Registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_data = resp.json().get('user', {})
        user_id = user_data.get('id')
        log(f"✅ User registered: {user_id}")
        
        # Get dashboard to retrieve demo bike
        log("\nGetting dashboard to retrieve demo bike...")
        resp = session.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: Dashboard request failed: {resp.status_code}")
            return False
        
        dashboard_data = resp.json()
        motos = dashboard_data.get('motos', [])
        
        if len(motos) == 0:
            log(f"❌ FAILED: No motorcycles found (demo bike not seeded)")
            return False
        
        demo_moto = motos[0]
        public_id = demo_moto.get('public_id')
        motorcycle_id = demo_moto.get('id')
        
        if not public_id:
            log(f"❌ FAILED: Demo bike missing public_id")
            return False
        
        log(f"✅ Demo bike found: {public_id}")
        log(f"   Motorcycle ID: {motorcycle_id}")
        
        # TEST 4: GET /api/public/{valid_public_id} (no auth) → 200 with all expected fields
        log("\n" + "=" * 80)
        log("TEST 4: GET /api/public/{valid_public_id} → 200 with all fields")
        log("=" * 80)
        
        resp = unauth_session.get(f"{BASE_URL}/public/{public_id}")
        log(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        try:
            data = resp.json()
        except json.JSONDecodeError:
            log(f"❌ FAILED: Response is not valid JSON")
            return False
        
        # Check all expected fields
        expected_fields = ['moto', 'owner', 'maintenance', 'timeline', 'modifications', 'gallery', 'postits', 'scan_count']
        missing_fields = []
        
        for field in expected_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            log(f"❌ FAILED: Missing expected fields: {missing_fields}")
            return False
        
        log(f"✅ PASSED: All expected fields present: {expected_fields}")
        
        # TEST 5: CRITICAL - Privacy check: moto object MUST NOT contain plate, owner_id, is_demo
        log("\n" + "=" * 80)
        log("TEST 5: PRIVACY CHECK - moto must NOT contain plate, owner_id, is_demo")
        log("=" * 80)
        
        moto = data.get('moto', {})
        privacy_violations = []
        
        if 'plate' in moto:
            privacy_violations.append('plate')
            log(f"❌ PRIVACY VIOLATION: 'plate' field exposed in moto object: {moto['plate']}")
        
        if 'owner_id' in moto:
            privacy_violations.append('owner_id')
            log(f"❌ PRIVACY VIOLATION: 'owner_id' field exposed in moto object: {moto['owner_id']}")
        
        if 'is_demo' in moto:
            privacy_violations.append('is_demo')
            log(f"❌ PRIVACY VIOLATION: 'is_demo' field exposed in moto object: {moto['is_demo']}")
        
        if privacy_violations:
            log(f"❌ FAILED: Privacy violations found: {privacy_violations}")
            log(f"   Moto object keys: {list(moto.keys())}")
            return False
        
        log(f"✅ PASSED: Privacy check successful - plate, owner_id, is_demo NOT exposed")
        log(f"   Moto object keys: {list(moto.keys())}")
        
        # TEST 6: Update motorcycle with plate, then re-fetch and confirm plate NOT exposed
        log("\n" + "=" * 80)
        log("TEST 6: Update moto with plate, re-fetch public profile, confirm plate NOT exposed")
        log("=" * 80)
        
        # Update motorcycle with plate
        update_data = {
            "plate": "AB123CD"
        }
        
        log(f"Updating motorcycle {motorcycle_id} with plate: AB123CD")
        resp = session.put(f"{BASE_URL}/motorcycles/{motorcycle_id}", json=update_data)
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Motorcycle update failed: {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ Motorcycle updated successfully")
        
        # Re-fetch public profile (no auth)
        log(f"\nRe-fetching public profile without auth...")
        resp = unauth_session.get(f"{BASE_URL}/public/{public_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Public profile fetch failed: {resp.status_code}")
            return False
        
        try:
            data = resp.json()
            moto = data.get('moto', {})
        except json.JSONDecodeError:
            log(f"❌ FAILED: Response is not valid JSON")
            return False
        
        # Check that plate is NOT in the response
        if 'plate' in moto:
            log(f"❌ FAILED: 'plate' field exposed after update: {moto['plate']}")
            log(f"   Moto object keys: {list(moto.keys())}")
            return False
        
        log(f"✅ PASSED: 'plate' field correctly NOT exposed after update")
        log(f"   Moto object keys: {list(moto.keys())}")
        
        # TEST 7: Regression - POST /api/public/{public_id}/postit (no auth) still works
        log("\n" + "=" * 80)
        log("TEST 7: Regression - POST /api/public/{public_id}/postit still works")
        log("=" * 80)
        
        postit_data = {
            "author_name": "Giovanni",
            "message": "Bellissima moto! Complimenti!"
        }
        
        log(f"Posting postit to {public_id}...")
        resp = unauth_session.post(f"{BASE_URL}/public/{public_id}/postit", json=postit_data)
        log(f"Status: {resp.status_code}")
        
        if resp.status_code != 201:
            log(f"❌ FAILED: Expected 201, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        try:
            data = resp.json()
            postit = data.get('postit', {})
            
            if not postit.get('id'):
                log(f"❌ FAILED: Postit response missing 'id'")
                return False
            
            if postit.get('author_name') != 'Giovanni':
                log(f"❌ FAILED: Postit author_name mismatch")
                return False
            
            if postit.get('message') != 'Bellissima moto! Complimenti!':
                log(f"❌ FAILED: Postit message mismatch")
                return False
            
            log(f"✅ PASSED: Postit created successfully")
            log(f"   Postit ID: {postit.get('id')}")
            log(f"   Author: {postit.get('author_name')}")
            log(f"   Message: {postit.get('message')}")
            
        except json.JSONDecodeError:
            log(f"❌ FAILED: Response is not valid JSON")
            return False
        
        # All tests passed
        log("\n" + "=" * 80)
        log("✅ ALL TESTS PASSED - Bug fix verification successful")
        log("=" * 80)
        log("\nSummary:")
        log("  ✅ TEST 1: GET /api/public/MDNA-DEMO returns 404 with JSON")
        log("  ✅ TEST 2: GET /api/public/NON-EXISTENT-XYZ123 returns 404 with JSON")
        log("  ✅ TEST 3: User registration and demo bike seeding works")
        log("  ✅ TEST 4: GET /api/public/{valid_public_id} returns 200 with all fields")
        log("  ✅ TEST 5: Privacy check - plate, owner_id, is_demo NOT exposed")
        log("  ✅ TEST 6: Plate update does not expose plate in public profile")
        log("  ✅ TEST 7: POST /api/public/{public_id}/postit regression test passed")
        
        return True
        
    except Exception as e:
        log(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    try:
        success = test_public_profile_bugfix()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\n⚠️  Test interrupted by user")
        exit(1)
    except Exception as e:
        log(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
