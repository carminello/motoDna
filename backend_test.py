#!/usr/bin/env python3
"""
MotoDNA Backend API Test - NFC Regenerate Endpoint Fix Verification
Tests the fix for route ordering bug where NFC handler is now before generic sub-resources handler
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_nfc_regenerate():
    """Test NFC tag regenerate endpoint after route ordering fix"""
    
    log("=" * 80)
    log("TEST: NFC Tag Regenerate Endpoint (Route Ordering Fix)")
    log("=" * 80)
    
    session = requests.Session()
    
    try:
        # Step 1: Register or login
        log("\n1. Authenticating user...")
        email = f"nfc_test_{int(time.time())}@motodna.test"
        password = "TestPass123!"
        
        register_data = {
            "email": email,
            "password": password,
            "first_name": "NFC",
            "last_name": "Tester"
        }
        
        resp = session.post(f"{BASE_URL}/auth/register", json=register_data)
        if resp.status_code == 200:
            log(f"✅ Register successful: {resp.status_code}")
        else:
            log(f"❌ Register failed: {resp.status_code} - {resp.text}")
            return False
        
        # Step 2: Get motorcycle from dashboard
        log("\n2. Getting motorcycle from dashboard...")
        resp = session.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ Dashboard failed: {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if not data.get('motos') or len(data['motos']) == 0:
            log("❌ No motorcycles found in dashboard")
            return False
        
        motorcycle_id = data['motos'][0]['id']
        log(f"✅ Found motorcycle: {motorcycle_id} ({data['motos'][0].get('brand')} {data['motos'][0].get('model')})")
        
        # Step 3: Get current NFC tag
        log("\n3. Getting current NFC tag...")
        resp = session.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        if resp.status_code != 200:
            log(f"❌ Get motorcycle failed: {resp.status_code} - {resp.text}")
            return False
        
        moto_data = resp.json()
        old_nfc = moto_data.get('nfc')
        if not old_nfc:
            log("❌ No NFC tag found on motorcycle")
            return False
        
        old_tag_uid = old_nfc.get('tag_uid')
        old_nfc_id = old_nfc.get('id')
        log(f"✅ Current NFC tag_uid: {old_tag_uid}")
        log(f"   Current NFC id: {old_nfc_id}")
        log(f"   Current status: {old_nfc.get('status')}")
        log(f"   Current scan_count: {old_nfc.get('scan_count')}")
        
        # Step 4: POST to regenerate NFC tag
        log("\n4. Regenerating NFC tag (POST /api/motorcycles/:id/nfc)...")
        resp = session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/nfc", json={})
        
        if resp.status_code != 200:
            log(f"❌ NFC regenerate FAILED: {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        new_nfc_data = resp.json()
        new_nfc = new_nfc_data.get('nfc')
        
        if not new_nfc:
            log(f"❌ No NFC object in response: {new_nfc_data}")
            return False
        
        new_tag_uid = new_nfc.get('tag_uid')
        new_nfc_id = new_nfc.get('id')
        new_status = new_nfc.get('status')
        new_scan_count = new_nfc.get('scan_count')
        
        log(f"✅ NFC regenerate SUCCESS: {resp.status_code}")
        log(f"   New NFC tag_uid: {new_tag_uid}")
        log(f"   New NFC id: {new_nfc_id}")
        log(f"   New status: {new_status}")
        log(f"   New scan_count: {new_scan_count}")
        
        # Step 5: Verify new tag is different
        log("\n5. Verifying new tag is different from old tag...")
        if new_tag_uid == old_tag_uid:
            log(f"❌ FAILED: New tag_uid is same as old tag_uid: {new_tag_uid}")
            return False
        
        if new_nfc_id == old_nfc_id:
            log(f"❌ FAILED: New NFC id is same as old NFC id: {new_nfc_id}")
            return False
        
        log(f"✅ New tag_uid is different: {old_tag_uid} -> {new_tag_uid}")
        log(f"✅ New NFC id is different: {old_nfc_id} -> {new_nfc_id}")
        
        # Step 6: Verify new tag has correct properties
        log("\n6. Verifying new tag properties...")
        if new_status != 'ACTIVE':
            log(f"❌ FAILED: New tag status is not ACTIVE: {new_status}")
            return False
        
        if new_scan_count != 0:
            log(f"❌ FAILED: New tag scan_count is not 0: {new_scan_count}")
            return False
        
        if not new_nfc.get('public_token'):
            log(f"❌ FAILED: New tag has no public_token")
            return False
        
        log(f"✅ New tag status is ACTIVE")
        log(f"✅ New tag scan_count is 0")
        log(f"✅ New tag has public_token: {new_nfc.get('public_token')[:20]}...")
        
        # Step 7: Verify GET returns the new active NFC
        log("\n7. Verifying GET /api/motorcycles/:id returns new NFC...")
        resp = session.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        if resp.status_code != 200:
            log(f"❌ Get motorcycle failed: {resp.status_code}")
            return False
        
        moto_data = resp.json()
        current_nfc = moto_data.get('nfc')
        
        if not current_nfc:
            log("❌ No NFC tag in GET response")
            return False
        
        if current_nfc.get('tag_uid') != new_tag_uid:
            log(f"❌ FAILED: GET returns different tag_uid: {current_nfc.get('tag_uid')} != {new_tag_uid}")
            return False
        
        if current_nfc.get('id') != new_nfc_id:
            log(f"❌ FAILED: GET returns different NFC id: {current_nfc.get('id')} != {new_nfc_id}")
            return False
        
        if current_nfc.get('status') != 'ACTIVE':
            log(f"❌ FAILED: GET returns non-ACTIVE status: {current_nfc.get('status')}")
            return False
        
        log(f"✅ GET returns the new ACTIVE NFC tag")
        log(f"   tag_uid: {current_nfc.get('tag_uid')}")
        log(f"   status: {current_nfc.get('status')}")
        
        log("\n" + "=" * 80)
        log("✅ NFC REGENERATE TEST PASSED - Route ordering fix is working!")
        log("=" * 80)
        
        return True, session, motorcycle_id
        
    except Exception as e:
        log(f"\n❌ TEST EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def smoke_test_other_endpoints(session, motorcycle_id):
    """Quick smoke test of other endpoints to ensure they still work"""
    
    log("\n" + "=" * 80)
    log("SMOKE TEST: Other Endpoints")
    log("=" * 80)
    
    try:
        # Test 1: POST maintenance
        log("\n1. Testing POST maintenance...")
        maint_data = {
            "service_type": "OIL_CHANGE",
            "title": "Smoke test oil change",
            "description": "Testing after NFC fix",
            "date": datetime.now().isoformat(),
            "mileage": 25000,
            "cost": 75.50,
            "currency": "EUR",
            "is_public": True
        }
        resp = session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance", json=maint_data)
        if resp.status_code != 200:
            log(f"❌ POST maintenance failed: {resp.status_code} - {resp.text}")
            return False
        
        maint_item = resp.json().get('item')
        maint_id = maint_item.get('id')
        log(f"✅ POST maintenance successful: {maint_id}")
        
        # Test 2: PATCH is_public
        log("\n2. Testing PATCH is_public...")
        resp = session.patch(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance/{maint_id}", 
                            json={"is_public": False})
        if resp.status_code != 200:
            log(f"❌ PATCH maintenance failed: {resp.status_code} - {resp.text}")
            return False
        
        updated_item = resp.json().get('item')
        if updated_item.get('is_public') != False:
            log(f"❌ is_public not updated: {updated_item.get('is_public')}")
            return False
        
        log(f"✅ PATCH is_public successful: {updated_item.get('is_public')}")
        
        # Test 3: DELETE maintenance
        log("\n3. Testing DELETE maintenance...")
        resp = session.delete(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance/{maint_id}")
        if resp.status_code != 200:
            log(f"❌ DELETE maintenance failed: {resp.status_code} - {resp.text}")
            return False
        
        log(f"✅ DELETE maintenance successful")
        
        # Test 4: GET public profile without auth
        log("\n4. Testing GET /api/public/:public_id (no auth)...")
        # First get the public_id
        resp = session.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        if resp.status_code != 200:
            log(f"❌ Get motorcycle failed: {resp.status_code}")
            return False
        
        public_id = resp.json().get('moto', {}).get('public_id')
        if not public_id:
            log("❌ No public_id found")
            return False
        
        # Now test public endpoint without auth
        public_session = requests.Session()
        resp = public_session.get(f"{BASE_URL}/public/{public_id}")
        if resp.status_code != 200:
            log(f"❌ Public endpoint failed: {resp.status_code} - {resp.text}")
            return False
        
        public_data = resp.json()
        if not public_data.get('moto'):
            log("❌ No moto in public response")
            return False
        
        log(f"✅ Public endpoint successful: {public_id}")
        log(f"   Scan count: {public_data.get('scan_count')}")
        
        log("\n" + "=" * 80)
        log("✅ SMOKE TEST PASSED - All other endpoints working!")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ SMOKE TEST EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    log("Starting MotoDNA Backend Tests - NFC Regenerate Fix Verification")
    log(f"Base URL: {BASE_URL}")
    log("")
    
    # Test NFC regenerate
    result = test_nfc_regenerate()
    
    if isinstance(result, tuple) and result[0]:
        nfc_passed = True
        session = result[1]
        motorcycle_id = result[2]
        
        # Run smoke tests
        smoke_passed = smoke_test_other_endpoints(session, motorcycle_id)
        
        if smoke_passed:
            log("\n" + "=" * 80)
            log("🎉 ALL TESTS PASSED!")
            log("=" * 80)
            exit(0)
        else:
            log("\n" + "=" * 80)
            log("⚠️  NFC test passed but smoke tests failed")
            log("=" * 80)
            exit(1)
    else:
        log("\n" + "=" * 80)
        log("❌ NFC REGENERATE TEST FAILED")
        log("=" * 80)
        exit(1)
