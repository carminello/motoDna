#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Post-it (Guestbook) Feature
Tests the new public post-it feature with rate limiting and owner moderation
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_postit_feature():
    """Test post-it (guestbook) feature end-to-end"""
    
    log("=" * 80)
    log("TEST: Post-it (Guestbook) Feature")
    log("=" * 80)
    
    owner_session = requests.Session()
    public_session = requests.Session()
    
    try:
        # Step 1: Try to login with existing demo user first, otherwise register
        log("\n1. Authenticating user...")
        email = "demo@motodna.app"
        password = "test123"
        
        # Try login first
        login_data = {"email": email, "password": password}
        resp = owner_session.post(f"{BASE_URL}/auth/login", json=login_data)
        
        if resp.status_code == 200:
            log(f"✅ Login successful with existing demo user: {resp.status_code}")
        else:
            # If login fails, try to register
            log(f"Login failed ({resp.status_code}), trying to register...")
            register_data = {
                "email": email,
                "password": password,
                "first_name": "Demo",
                "last_name": "User"
            }
            resp = owner_session.post(f"{BASE_URL}/auth/register", json=register_data)
            if resp.status_code == 200:
                log(f"✅ Register successful: {resp.status_code}")
            else:
                log(f"❌ Register failed: {resp.status_code} - {resp.text}")
                return False
        
        # Step 2: Get motorcycle from dashboard
        log("\n2. Getting motorcycle from dashboard...")
        resp = owner_session.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ Dashboard failed: {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if not data.get('motos') or len(data['motos']) == 0:
            log("❌ No motorcycles found in dashboard")
            return False
        
        motorcycle_id = data['motos'][0]['id']
        public_id = data['motos'][0]['public_id']
        log(f"✅ Found motorcycle: {motorcycle_id}")
        log(f"   Public ID: {public_id}")
        log(f"   Brand/Model: {data['motos'][0].get('brand')} {data['motos'][0].get('model')}")
        
        # Step 3: Ensure motorcycle is public
        log("\n3. Ensuring motorcycle has public_profile=true...")
        resp = owner_session.put(f"{BASE_URL}/motorcycles/{motorcycle_id}", 
                                 json={"public_profile": True})
        if resp.status_code != 200:
            log(f"❌ Failed to set public_profile: {resp.status_code} - {resp.text}")
            return False
        log(f"✅ Motorcycle set to public")
        
        # TEST 1: POST valid post-it without auth
        log("\n" + "=" * 80)
        log("TEST 1: POST /api/public/{public_id}/postit with valid data (no auth)")
        log("=" * 80)
        
        postit_data = {
            "author_name": "Marco",
            "message": "Bellissima moto!"
        }
        
        resp = public_session.post(f"{BASE_URL}/public/{public_id}/postit", json=postit_data)
        
        if resp.status_code != 201:
            log(f"❌ FAILED: Expected 201, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        postit_response = resp.json()
        postit1 = postit_response.get('postit')
        
        if not postit1:
            log(f"❌ FAILED: No postit object in response")
            return False
        
        # Verify postit structure
        required_fields = ['id', 'author_name', 'message', 'created_at', 'is_hidden']
        for field in required_fields:
            if field not in postit1:
                log(f"❌ FAILED: Missing field '{field}' in postit object")
                return False
        
        if postit1['author_name'] != "Marco":
            log(f"❌ FAILED: author_name mismatch: {postit1['author_name']}")
            return False
        
        if postit1['message'] != "Bellissima moto!":
            log(f"❌ FAILED: message mismatch: {postit1['message']}")
            return False
        
        if postit1['is_hidden'] != False:
            log(f"❌ FAILED: is_hidden should be False, got {postit1['is_hidden']}")
            return False
        
        postit1_id = postit1['id']
        log(f"✅ TEST 1 PASSED: Post-it created successfully")
        log(f"   ID: {postit1_id}")
        log(f"   Author: {postit1['author_name']}")
        log(f"   Message: {postit1['message']}")
        log(f"   is_hidden: {postit1['is_hidden']}")
        
        # TEST 2: POST with empty message
        log("\n" + "=" * 80)
        log("TEST 2: POST /api/public/{public_id}/postit with empty message")
        log("=" * 80)
        
        empty_data = {
            "author_name": "Test",
            "message": ""
        }
        
        resp = public_session.post(f"{BASE_URL}/public/{public_id}/postit", json=empty_data)
        
        if resp.status_code != 400:
            log(f"❌ FAILED: Expected 400, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ TEST 2 PASSED: Empty message correctly rejected with 400")
        
        # TEST 3: Rate limiting - POST 6 times quickly
        log("\n" + "=" * 80)
        log("TEST 3: Rate limiting - POST 6 times quickly (6th should be 429)")
        log("=" * 80)
        
        rate_limit_session = requests.Session()
        success_count = 0
        rate_limited = False
        
        for i in range(6):
            postit_data = {
                "author_name": f"RateTest{i+1}",
                "message": f"Rate limit test message {i+1}"
            }
            resp = rate_limit_session.post(f"{BASE_URL}/public/{public_id}/postit", json=postit_data)
            log(f"   Attempt {i+1}: {resp.status_code}")
            
            if resp.status_code == 201:
                success_count += 1
            elif resp.status_code == 429:
                rate_limited = True
                log(f"   ✅ Rate limited on attempt {i+1}")
                break
        
        if not rate_limited:
            log(f"❌ FAILED: Expected 429 rate limit, but all {success_count} requests succeeded")
            return False
        
        if success_count != 5:
            log(f"⚠️  WARNING: Expected 5 successful posts before rate limit, got {success_count}")
        
        log(f"✅ TEST 3 PASSED: Rate limiting working ({success_count} succeeded, then 429)")
        
        # Wait a bit to avoid rate limiting for next tests
        log("   Waiting 2 seconds to clear rate limit...")
        time.sleep(2)
        
        # TEST 4: GET public endpoint - should include postits[] with non-hidden
        log("\n" + "=" * 80)
        log("TEST 4: GET /api/public/{public_id} without auth - verify postits[] array")
        log("=" * 80)
        
        resp = public_session.get(f"{BASE_URL}/public/{public_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        public_data = resp.json()
        postits_public = public_data.get('postits')
        
        if postits_public is None:
            log(f"❌ FAILED: No 'postits' field in response")
            return False
        
        if not isinstance(postits_public, list):
            log(f"❌ FAILED: 'postits' is not an array")
            return False
        
        # Find our first post-it
        found_postit1 = False
        for p in postits_public:
            if p.get('id') == postit1_id:
                found_postit1 = True
                if p.get('message') != "Bellissima moto!":
                    log(f"❌ FAILED: Post-it message mismatch")
                    return False
                break
        
        if not found_postit1:
            log(f"❌ FAILED: Original post-it not found in public postits[]")
            return False
        
        log(f"✅ TEST 4 PASSED: Public endpoint returns postits[] array")
        log(f"   Total postits visible: {len(postits_public)}")
        log(f"   Original post-it found: {found_postit1}")
        
        # TEST 5: GET as owner - should include ALL postits (including hidden)
        log("\n" + "=" * 80)
        log("TEST 5: GET /api/motorcycles/{id} as owner - verify ALL postits")
        log("=" * 80)
        
        resp = owner_session.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        owner_data = resp.json()
        postits_owner = owner_data.get('postits')
        
        if postits_owner is None:
            log(f"❌ FAILED: No 'postits' field in owner response")
            return False
        
        if not isinstance(postits_owner, list):
            log(f"❌ FAILED: 'postits' is not an array")
            return False
        
        # Find our first post-it
        found_postit1_owner = False
        for p in postits_owner:
            if p.get('id') == postit1_id:
                found_postit1_owner = True
                break
        
        if not found_postit1_owner:
            log(f"❌ FAILED: Original post-it not found in owner postits[]")
            return False
        
        log(f"✅ TEST 5 PASSED: Owner endpoint returns postits[] array")
        log(f"   Total postits (owner view): {len(postits_owner)}")
        
        # TEST 6: PATCH to hide a post-it
        log("\n" + "=" * 80)
        log("TEST 6: PATCH /api/motorcycles/{id}/postits/{postit_id} to hide")
        log("=" * 80)
        
        resp = owner_session.patch(
            f"{BASE_URL}/motorcycles/{motorcycle_id}/postits/{postit1_id}",
            json={"is_hidden": True}
        )
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        patch_response = resp.json()
        updated_item = patch_response.get('item')
        
        if not updated_item:
            log(f"❌ FAILED: No 'item' in response")
            return False
        
        if updated_item.get('is_hidden') != True:
            log(f"❌ FAILED: is_hidden not updated to True: {updated_item.get('is_hidden')}")
            return False
        
        log(f"✅ TEST 6 PASSED: Post-it hidden successfully")
        log(f"   is_hidden: {updated_item.get('is_hidden')}")
        
        # TEST 7: GET public endpoint again - hidden post-it should NOT appear
        log("\n" + "=" * 80)
        log("TEST 7: GET /api/public/{public_id} - verify hidden postit NOT visible")
        log("=" * 80)
        
        resp = public_session.get(f"{BASE_URL}/public/{public_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        public_data = resp.json()
        postits_public_after = public_data.get('postits', [])
        
        # Check that our hidden post-it is NOT in the list
        found_hidden = False
        for p in postits_public_after:
            if p.get('id') == postit1_id:
                found_hidden = True
                break
        
        if found_hidden:
            log(f"❌ FAILED: Hidden post-it still visible in public endpoint")
            return False
        
        log(f"✅ TEST 7 PASSED: Hidden post-it correctly excluded from public view")
        log(f"   Visible postits: {len(postits_public_after)}")
        
        # Verify owner can still see it
        resp = owner_session.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        owner_data = resp.json()
        postits_owner_after = owner_data.get('postits', [])
        
        found_in_owner = False
        for p in postits_owner_after:
            if p.get('id') == postit1_id and p.get('is_hidden') == True:
                found_in_owner = True
                break
        
        if not found_in_owner:
            log(f"❌ FAILED: Hidden post-it not visible to owner")
            return False
        
        log(f"   ✅ Hidden post-it still visible to owner (as expected)")
        
        # TEST 8: DELETE post-it
        log("\n" + "=" * 80)
        log("TEST 8: DELETE /api/motorcycles/{id}/postits/{postit_id}")
        log("=" * 80)
        
        resp = owner_session.delete(f"{BASE_URL}/motorcycles/{motorcycle_id}/postits/{postit1_id}")
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ DELETE successful: {resp.status_code}")
        
        # Verify it's gone
        resp = owner_session.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        owner_data = resp.json()
        postits_after_delete = owner_data.get('postits', [])
        
        found_after_delete = False
        for p in postits_after_delete:
            if p.get('id') == postit1_id:
                found_after_delete = True
                break
        
        if found_after_delete:
            log(f"❌ FAILED: Post-it still exists after DELETE")
            return False
        
        log(f"✅ TEST 8 PASSED: Post-it successfully deleted")
        
        # TEST 9: Set public_profile=false then try to POST
        log("\n" + "=" * 80)
        log("TEST 9: Set public_profile=false, then POST postit -> expect 404")
        log("=" * 80)
        
        resp = owner_session.put(f"{BASE_URL}/motorcycles/{motorcycle_id}", 
                                 json={"public_profile": False})
        if resp.status_code != 200:
            log(f"❌ Failed to set public_profile=false: {resp.status_code}")
            return False
        
        log(f"   Set public_profile=false")
        
        # Try to post a post-it
        private_postit_data = {
            "author_name": "TestPrivate",
            "message": "This should fail"
        }
        
        resp = public_session.post(f"{BASE_URL}/public/{public_id}/postit", json=private_postit_data)
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ TEST 9 PASSED: POST to private bike correctly returns 404")
        
        # Restore public_profile for regression tests
        log("   Restoring public_profile=true for regression tests...")
        resp = owner_session.put(f"{BASE_URL}/motorcycles/{motorcycle_id}", 
                                 json={"public_profile": True})
        if resp.status_code != 200:
            log(f"⚠️  WARNING: Failed to restore public_profile")
        
        # TEST 10: Regression - verify other endpoints still work
        log("\n" + "=" * 80)
        log("TEST 10: Regression - verify other endpoints still work")
        log("=" * 80)
        
        # Test 10a: POST maintenance
        log("\n   10a. Testing POST maintenance...")
        maint_data = {
            "service_type": "OIL_CHANGE",
            "title": "Post-it regression test",
            "description": "Verify maintenance still works",
            "date": datetime.now().isoformat(),
            "mileage": 30000,
            "cost": 80.00,
            "currency": "EUR",
            "is_public": True
        }
        resp = owner_session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance", json=maint_data)
        if resp.status_code != 200:
            log(f"   ❌ POST maintenance failed: {resp.status_code} - {resp.text}")
            return False
        
        maint_id = resp.json().get('item', {}).get('id')
        log(f"   ✅ POST maintenance successful: {maint_id}")
        
        # Test 10b: POST NFC regenerate
        log("\n   10b. Testing POST /api/motorcycles/:id/nfc...")
        resp = owner_session.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/nfc", json={})
        if resp.status_code != 200:
            log(f"   ❌ POST NFC failed: {resp.status_code} - {resp.text}")
            return False
        
        nfc_data = resp.json().get('nfc', {})
        log(f"   ✅ POST NFC successful: {nfc_data.get('tag_uid')}")
        
        # Test 10c: POST upload
        log("\n   10c. Testing POST /api/uploads...")
        # Create a tiny 1x1 PNG
        import base64
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        upload_data = {
            "data": f"data:image/png;base64,{tiny_png}",
            "filename": "test.png"
        }
        resp = owner_session.post(f"{BASE_URL}/uploads", json=upload_data)
        if resp.status_code != 201:
            log(f"   ❌ POST upload failed: {resp.status_code} - {resp.text}")
            return False
        
        file_id = resp.json().get('id')
        log(f"   ✅ POST upload successful: {file_id}")
        
        # Clean up maintenance
        if maint_id:
            owner_session.delete(f"{BASE_URL}/motorcycles/{motorcycle_id}/maintenance/{maint_id}")
        
        log(f"\n✅ TEST 10 PASSED: All regression tests successful")
        
        log("\n" + "=" * 80)
        log("🎉 ALL POST-IT TESTS PASSED!")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    log("Starting MotoDNA Backend Tests - Post-it (Guestbook) Feature")
    log(f"Base URL: {BASE_URL}")
    log("")
    
    result = test_postit_feature()
    
    if result:
        log("\n" + "=" * 80)
        log("✅ ALL TESTS PASSED!")
        log("=" * 80)
        exit(0)
    else:
        log("\n" + "=" * 80)
        log("❌ TESTS FAILED")
        log("=" * 80)
        exit(1)
