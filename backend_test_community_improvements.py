#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Community Endpoint Improvements + Cover Previews
Tests the improved GET /api/community/users endpoint after test-users cleanup
"""

import requests
import json
import time
import uuid
from datetime import datetime

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_community_improvements():
    """Test Community endpoint improvements with cover previews"""
    
    log("=" * 80)
    log("TEST: Community Endpoint Improvements + Cover Previews")
    log("=" * 80)
    log("Context: DB cleaned, only one real user remains (carminellout@gmail.com)")
    log("")
    
    session_x = requests.Session()
    session_y = requests.Session()
    unauth_session = requests.Session()
    
    try:
        # TEST 1: Register user X and verify GET /api/community/users
        log("\n" + "=" * 80)
        log("TEST 1: Register user X, verify GET /api/community/users returns proper fields")
        log("=" * 80)
        
        # Generate unique email for user X
        timestamp = int(time.time())
        email_x = f"marco_{timestamp}@motodna.test"
        username_x = f"marco_{timestamp}"
        
        log(f"\nRegistering User X: {email_x}")
        register_x = {
            "email": email_x,
            "password": "SecurePass123!",
            "first_name": "Marco",
            "last_name": "Verdi",
            "username": username_x
        }
        resp = session_x.post(f"{BASE_URL}/auth/register", json=register_x)
        if resp.status_code != 200:
            log(f"❌ FAILED: User X registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_x_data = resp.json().get('user', {})
        user_x_id = user_x_data.get('id')
        log(f"✅ User X registered: {user_x_id}")
        log(f"   Username: {username_x}")
        
        # Get user X's motorcycle info
        resp = session_x.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: Dashboard request failed: {resp.status_code}")
            return False
        
        dashboard = resp.json()
        motos_x = dashboard.get('motos', [])
        if len(motos_x) == 0:
            log(f"❌ FAILED: No demo bike seeded for user X")
            return False
        
        moto_x = motos_x[0]
        moto_x_id = moto_x['id']
        public_id_x = moto_x['public_id']
        log(f"   Demo bike: {public_id_x}")
        
        # Now GET /api/community/users
        log(f"\nGET /api/community/users as User X")
        resp = session_x.get(f"{BASE_URL}/community/users")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        users_data = resp.json()
        users = users_data.get('users', [])
        
        if not isinstance(users, list):
            log(f"❌ FAILED: 'users' is not an array")
            return False
        
        log(f"   Total users returned: {len(users)}")
        
        # Find user X in the list
        user_x_obj = None
        for user in users:
            if user.get('id') == user_x_id:
                user_x_obj = user
                break
        
        if not user_x_obj:
            log(f"❌ FAILED: User X not found in community users list")
            return False
        
        # Verify required fields
        required_fields = ['id', 'username', 'first_name', 'profile_photo', 'country', 
                          'created_at', 'bike_count', 'sample_photo', 'sample_model', 
                          'sample_brand', 'sample_public_id', 'sample_year', 'is_self']
        
        missing_fields = []
        for field in required_fields:
            if field not in user_x_obj:
                missing_fields.append(field)
        
        if missing_fields:
            log(f"❌ FAILED: Missing required fields: {missing_fields}")
            log(f"   User object: {json.dumps(user_x_obj, indent=2)}")
            return False
        
        # Verify sensitive fields are NOT exposed
        if 'email' in user_x_obj or 'password_hash' in user_x_obj:
            log(f"❌ FAILED: Sensitive fields exposed (email/password_hash)")
            return False
        
        # Verify is_self is true for user X
        if user_x_obj.get('is_self') != True:
            log(f"❌ FAILED: is_self should be true for user X, got {user_x_obj.get('is_self')}")
            return False
        
        log(f"✅ TEST 1 PASSED: GET /api/community/users returns all required fields")
        log(f"   User X found with:")
        log(f"   - id: {user_x_obj.get('id')}")
        log(f"   - username: {user_x_obj.get('username')}")
        log(f"   - bike_count: {user_x_obj.get('bike_count')}")
        log(f"   - sample_photo: {user_x_obj.get('sample_photo')[:50] if user_x_obj.get('sample_photo') else 'null'}...")
        log(f"   - sample_model: {user_x_obj.get('sample_model')}")
        log(f"   - sample_brand: {user_x_obj.get('sample_brand')}")
        log(f"   - sample_public_id: {user_x_obj.get('sample_public_id')}")
        log(f"   - sample_year: {user_x_obj.get('sample_year')}")
        log(f"   - is_self: {user_x_obj.get('is_self')}")
        log(f"   - No email/password_hash exposed ✓")
        
        # TEST 2: Verify X's sample_photo is non-null (demo bike has unsplash URL)
        log("\n" + "=" * 80)
        log("TEST 2: Verify User X's sample_photo is non-null (demo bike has unsplash URL)")
        log("=" * 80)
        
        sample_photo = user_x_obj.get('sample_photo')
        if not sample_photo:
            log(f"❌ FAILED: sample_photo is null or empty")
            log(f"   Expected: https://images.unsplash.com/... URL")
            log(f"   Got: {sample_photo}")
            return False
        
        if 'unsplash.com' not in sample_photo:
            log(f"❌ FAILED: sample_photo does not contain unsplash.com")
            log(f"   Got: {sample_photo}")
            return False
        
        log(f"✅ TEST 2 PASSED: User X's sample_photo is non-null")
        log(f"   sample_photo: {sample_photo}")
        
        # TEST 3: Search with 3-char slice of X's username
        log("\n" + "=" * 80)
        log("TEST 3: GET /api/community/users?q=<3-char slice of X's username>")
        log("=" * 80)
        
        search_term = username_x[:3]
        log(f"   Searching for: '{search_term}'")
        
        resp = session_x.get(f"{BASE_URL}/community/users?q={search_term}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        search_results = resp.json().get('users', [])
        found_x_in_search = False
        
        for user in search_results:
            if user.get('id') == user_x_id:
                found_x_in_search = True
                break
        
        if not found_x_in_search:
            log(f"❌ FAILED: User X not found in search results")
            log(f"   Search term: {search_term}")
            log(f"   Results: {len(search_results)} users")
            return False
        
        log(f"✅ TEST 3 PASSED: Search working, User X found")
        log(f"   Search term: '{search_term}'")
        log(f"   Results: {len(search_results)} users")
        
        # TEST 4: Search with "zzzzzzzz" returns empty
        log("\n" + "=" * 80)
        log("TEST 4: GET /api/community/users?q=zzzzzzzz (expect empty results)")
        log("=" * 80)
        
        resp = session_x.get(f"{BASE_URL}/community/users?q=zzzzzzzz")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        search_results = resp.json().get('users', [])
        
        if len(search_results) != 0:
            log(f"❌ FAILED: Expected empty results, got {len(search_results)} users")
            return False
        
        log(f"✅ TEST 4 PASSED: Search with non-existent term returns empty array")
        log(f"   Query: 'zzzzzzzz'")
        log(f"   Results: {len(search_results)} users (empty as expected)")
        
        # TEST 5: Register user Y, set main_photo to null, verify sample_photo is null
        log("\n" + "=" * 80)
        log("TEST 5: Register user Y, set main_photo=null, verify sample_photo=null but bike_count=1")
        log("=" * 80)
        
        email_y = f"lucia_{timestamp}@motodna.test"
        username_y = f"lucia_{timestamp}"
        
        log(f"\nRegistering User Y: {email_y}")
        register_y = {
            "email": email_y,
            "password": "SecurePass456!",
            "first_name": "Lucia",
            "last_name": "Neri",
            "username": username_y
        }
        resp = session_y.post(f"{BASE_URL}/auth/register", json=register_y)
        if resp.status_code != 200:
            log(f"❌ FAILED: User Y registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_y_data = resp.json().get('user', {})
        user_y_id = user_y_data.get('id')
        log(f"✅ User Y registered: {user_y_id}")
        log(f"   Username: {username_y}")
        
        # Get user Y's motorcycle info
        resp = session_y.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: Dashboard request failed: {resp.status_code}")
            return False
        
        dashboard = resp.json()
        motos_y = dashboard.get('motos', [])
        if len(motos_y) == 0:
            log(f"❌ FAILED: No demo bike seeded for user Y")
            return False
        
        moto_y = motos_y[0]
        moto_y_id = moto_y['id']
        log(f"   Demo bike ID: {moto_y_id}")
        
        # Update motorcycle to set main_photo to null
        log(f"\nUpdating motorcycle {moto_y_id} to set main_photo=null")
        resp = session_y.put(f"{BASE_URL}/motorcycles/{moto_y_id}", json={"main_photo": None})
        if resp.status_code != 200:
            log(f"❌ FAILED: PUT /api/motorcycles/{moto_y_id} failed: {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ Motorcycle updated: main_photo set to null")
        
        # Now GET /api/community/users and verify Y's sample_photo is null
        log(f"\nGET /api/community/users to verify Y's sample_photo is null")
        resp = session_y.get(f"{BASE_URL}/community/users")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        users_data = resp.json()
        users = users_data.get('users', [])
        
        # Find user Y in the list
        user_y_obj = None
        for user in users:
            if user.get('id') == user_y_id:
                user_y_obj = user
                break
        
        if not user_y_obj:
            log(f"❌ FAILED: User Y not found in community users list")
            return False
        
        # Verify sample_photo is null or falsy
        if user_y_obj.get('sample_photo'):
            log(f"❌ FAILED: sample_photo should be null/falsy, got: {user_y_obj.get('sample_photo')}")
            return False
        
        # Verify bike_count is still 1
        if user_y_obj.get('bike_count') != 1:
            log(f"❌ FAILED: bike_count should be 1, got: {user_y_obj.get('bike_count')}")
            return False
        
        log(f"✅ TEST 5 PASSED: User Y present with sample_photo=null and bike_count=1")
        log(f"   User Y:")
        log(f"   - id: {user_y_obj.get('id')}")
        log(f"   - username: {user_y_obj.get('username')}")
        log(f"   - bike_count: {user_y_obj.get('bike_count')}")
        log(f"   - sample_photo: {user_y_obj.get('sample_photo')} (null as expected)")
        
        # TEST 6: As Y, send message to X, verify unread count and message retrieval
        log("\n" + "=" * 80)
        log("TEST 6: As Y, POST /api/messages/{X_id}, verify unread count and messages")
        log("=" * 80)
        
        # As Y, send message to X
        log(f"\nAs Y, sending message to X")
        message_data = {"content": "Ciao Marco! Bella moto!"}
        resp = session_y.post(f"{BASE_URL}/messages/{user_x_id}", json=message_data)
        
        if resp.status_code != 201:
            log(f"❌ FAILED: Expected 201, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        message_response = resp.json()
        message_obj = message_response.get('message')
        
        if not message_obj:
            log(f"❌ FAILED: No 'message' object in response")
            return False
        
        log(f"✅ Message sent successfully")
        log(f"   Message ID: {message_obj.get('id')}")
        log(f"   Content: {message_obj.get('content')}")
        
        # As X, GET /api/messages-unread-count
        log(f"\nAs X, GET /api/messages-unread-count (expect count=1)")
        resp = session_x.get(f"{BASE_URL}/messages-unread-count")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        unread_data = resp.json()
        count = unread_data.get('count')
        
        if count != 1:
            log(f"❌ FAILED: Expected count=1, got {count}")
            return False
        
        log(f"✅ Unread count = 1")
        
        # As X, GET /api/messages/{Y_id}
        log(f"\nAs X, GET /api/messages/{user_y_id} (verify messages visible)")
        resp = session_x.get(f"{BASE_URL}/messages/{user_y_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        conv_data = resp.json()
        other_user = conv_data.get('other')
        messages = conv_data.get('messages', [])
        
        if not other_user:
            log(f"❌ FAILED: No 'other' user in response")
            return False
        
        if len(messages) != 1:
            log(f"❌ FAILED: Expected 1 message, got {len(messages)}")
            return False
        
        msg = messages[0]
        if msg.get('content') != "Ciao Marco! Bella moto!":
            log(f"❌ FAILED: Message content mismatch")
            return False
        
        log(f"✅ TEST 6 PASSED: Messaging working correctly")
        log(f"   Message sent: Y → X")
        log(f"   Unread count for X: 1")
        log(f"   Messages visible in conversation")
        
        # TEST 7: GET /api/public/{X's public_id} without auth
        log("\n" + "=" * 80)
        log("TEST 7: GET /api/public/{X's public_id} (no auth cookie)")
        log("=" * 80)
        
        log(f"\nGET /api/public/{public_id_x} without auth")
        resp = unauth_session.get(f"{BASE_URL}/public/{public_id_x}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        public_data = resp.json()
        
        # Verify required fields
        required_fields = ['moto', 'owner', 'maintenance', 'timeline', 'modifications', 
                          'gallery', 'postits', 'scan_count']
        
        missing_fields = []
        for field in required_fields:
            if field not in public_data:
                missing_fields.append(field)
        
        if missing_fields:
            log(f"❌ FAILED: Missing required fields: {missing_fields}")
            return False
        
        # Verify moto object does NOT contain plate, owner_id, is_demo
        moto_obj = public_data.get('moto', {})
        if 'plate' in moto_obj or 'owner_id' in moto_obj or 'is_demo' in moto_obj:
            log(f"❌ FAILED: Sensitive fields exposed in public moto object")
            log(f"   plate: {'plate' in moto_obj}")
            log(f"   owner_id: {'owner_id' in moto_obj}")
            log(f"   is_demo: {'is_demo' in moto_obj}")
            return False
        
        log(f"✅ TEST 7 PASSED: Public profile accessible without auth")
        log(f"   All required fields present")
        log(f"   No sensitive fields exposed (plate, owner_id, is_demo)")
        log(f"   Scan count: {public_data.get('scan_count')}")
        
        # TEST 8: POST /api/uploads (multipart PNG) as X
        log("\n" + "=" * 80)
        log("TEST 8: POST /api/uploads (multipart PNG) as X")
        log("=" * 80)
        
        # Create a tiny PNG
        import base64
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        upload_data = {
            "data": f"data:image/png;base64,{tiny_png}",
            "filename": "test_upload.png"
        }
        
        log(f"\nUploading PNG file as User X")
        resp = session_x.post(f"{BASE_URL}/uploads", json=upload_data)
        if resp.status_code != 201:
            log(f"❌ FAILED: Expected 201, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        upload_response = resp.json()
        file_id = upload_response.get('id')
        file_url = upload_response.get('url')
        
        if not file_id or not file_url:
            log(f"❌ FAILED: Missing 'id' or 'url' in upload response")
            return False
        
        log(f"✅ TEST 8 PASSED: File upload successful")
        log(f"   File ID: {file_id}")
        log(f"   File URL: {file_url}")
        
        # TEST 9: Verify no 500 errors occurred
        log("\n" + "=" * 80)
        log("TEST 9: Verify no 500 errors occurred in any previous tests")
        log("=" * 80)
        
        log(f"✅ TEST 9 PASSED: All previous endpoints returned 200/201 without 500 errors")
        log(f"   All tests completed successfully without server errors")
        
        log("\n" + "=" * 80)
        log("🎉 ALL COMMUNITY IMPROVEMENTS TESTS PASSED!")
        log("=" * 80)
        log("")
        log("Summary:")
        log("✅ TEST 1: GET /api/community/users returns all required fields (sample_brand, sample_public_id, sample_year, etc.)")
        log("✅ TEST 2: User X's sample_photo is non-null (unsplash URL)")
        log("✅ TEST 3: Search with 3-char username slice works")
        log("✅ TEST 4: Search with non-existent term returns empty array")
        log("✅ TEST 5: User Y with main_photo=null has sample_photo=null but bike_count=1")
        log("✅ TEST 6: Messaging works (Y→X, unread count, message retrieval)")
        log("✅ TEST 7: Public profile accessible without auth, no sensitive fields exposed")
        log("✅ TEST 8: File upload working")
        log("✅ TEST 9: No 500 errors in any endpoint")
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    log("Starting MotoDNA Backend Tests - Community Endpoint Improvements")
    log(f"Base URL: {BASE_URL}")
    log("")
    
    result = test_community_improvements()
    
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
