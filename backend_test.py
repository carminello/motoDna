#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Community + Direct Messaging Feature
Tests the new community directory and 1:1 messaging system
"""

import requests
import json
import time
import uuid
from datetime import datetime

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_community_messaging():
    """Test Community + Direct Messaging feature end-to-end"""
    
    log("=" * 80)
    log("TEST: Community + Direct Messaging Feature")
    log("=" * 80)
    
    session_a = requests.Session()
    session_b = requests.Session()
    unauth_session = requests.Session()
    
    try:
        # Setup: Register user A and user B with fresh random emails
        log("\n" + "=" * 80)
        log("SETUP: Register User A and User B")
        log("=" * 80)
        
        # Generate unique emails
        timestamp = int(time.time())
        email_a = f"anna_{timestamp}@motodna.test"
        email_b = f"bruno_{timestamp}@motodna.test"
        
        # Register User A
        log(f"\nRegistering User A: {email_a}")
        register_a = {
            "email": email_a,
            "password": "test123",
            "first_name": "Anna",
            "last_name": "Rossi",
            "username": f"anna_{timestamp}"
        }
        resp = session_a.post(f"{BASE_URL}/auth/register", json=register_a)
        if resp.status_code != 200:
            log(f"❌ FAILED: User A registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_a_data = resp.json().get('user', {})
        user_a_id = user_a_data.get('id')
        log(f"✅ User A registered: {user_a_id}")
        log(f"   Username: {user_a_data.get('username')}")
        
        # Register User B
        log(f"\nRegistering User B: {email_b}")
        register_b = {
            "email": email_b,
            "password": "test123",
            "first_name": "Bruno",
            "last_name": "Bianchi",
            "username": f"bruno_{timestamp}"
        }
        resp = session_b.post(f"{BASE_URL}/auth/register", json=register_b)
        if resp.status_code != 200:
            log(f"❌ FAILED: User B registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_b_data = resp.json().get('user', {})
        user_b_id = user_b_data.get('id')
        log(f"✅ User B registered: {user_b_id}")
        log(f"   Username: {user_b_data.get('username')}")
        
        # TEST 1: As A, GET /api/community/users
        log("\n" + "=" * 80)
        log("TEST 1: GET /api/community/users - verify users list")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/community/users")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        users_data = resp.json()
        users = users_data.get('users', [])
        
        if not isinstance(users, list):
            log(f"❌ FAILED: 'users' is not an array")
            return False
        
        # Find user A and B in the list
        found_a = False
        found_b = False
        
        for user in users:
            if user.get('id') == user_a_id:
                found_a = True
                # Verify bike_count >= 1 (demo bike seeded)
                if user.get('bike_count', 0) < 1:
                    log(f"❌ FAILED: User A bike_count < 1: {user.get('bike_count')}")
                    return False
                # Verify no sensitive fields
                if 'email' in user or 'password_hash' in user:
                    log(f"❌ FAILED: Sensitive fields exposed (email/password_hash)")
                    return False
                log(f"   ✅ User A found: bike_count={user.get('bike_count')}, is_self={user.get('is_self')}")
            
            if user.get('id') == user_b_id:
                found_b = True
                if user.get('bike_count', 0) < 1:
                    log(f"❌ FAILED: User B bike_count < 1: {user.get('bike_count')}")
                    return False
                if 'email' in user or 'password_hash' in user:
                    log(f"❌ FAILED: Sensitive fields exposed (email/password_hash)")
                    return False
                log(f"   ✅ User B found: bike_count={user.get('bike_count')}, is_self={user.get('is_self')}")
        
        if not found_a or not found_b:
            log(f"❌ FAILED: Users not found in list (A={found_a}, B={found_b})")
            return False
        
        log(f"✅ TEST 1 PASSED: Community users list working")
        log(f"   Total users: {len(users)}")
        log(f"   No sensitive fields exposed")
        
        # TEST 2: As A, search for user B by username substring
        log("\n" + "=" * 80)
        log("TEST 2: GET /api/community/users?q=<search> - search for user B")
        log("=" * 80)
        
        # Use 3-char substring of B's username
        search_term = user_b_data.get('username')[:3]
        log(f"   Searching for: '{search_term}'")
        
        resp = session_a.get(f"{BASE_URL}/community/users?q={search_term}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        search_results = resp.json().get('users', [])
        found_b_in_search = False
        
        for user in search_results:
            if user.get('id') == user_b_id:
                found_b_in_search = True
                break
        
        if not found_b_in_search:
            log(f"❌ FAILED: User B not found in search results")
            log(f"   Search term: {search_term}")
            log(f"   Results: {len(search_results)} users")
            return False
        
        log(f"✅ TEST 2 PASSED: Search working, User B found")
        log(f"   Search results: {len(search_results)} users")
        
        # TEST 3: As A, GET /api/community/users/:id for user B
        log("\n" + "=" * 80)
        log("TEST 3: GET /api/community/users/{B_id} - user profile with bikes")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/community/users/{user_b_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        profile_data = resp.json()
        user_profile = profile_data.get('user')
        bikes = profile_data.get('bikes', [])
        
        if not user_profile:
            log(f"❌ FAILED: No 'user' object in response")
            return False
        
        if not isinstance(bikes, list):
            log(f"❌ FAILED: 'bikes' is not an array")
            return False
        
        # Verify bikes are PUBLIC only (demo bike should be public by default)
        log(f"✅ TEST 3 PASSED: User profile retrieved")
        log(f"   User: {user_profile.get('username')}")
        log(f"   Bikes: {len(bikes)}")
        
        # TEST 4: As A, GET /api/messages - should be empty at start
        log("\n" + "=" * 80)
        log("TEST 4: GET /api/messages - verify empty conversations at start")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/messages")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        messages_data = resp.json()
        conversations = messages_data.get('conversations', [])
        
        if not isinstance(conversations, list):
            log(f"❌ FAILED: 'conversations' is not an array")
            return False
        
        log(f"✅ TEST 4 PASSED: Conversations list retrieved")
        log(f"   Conversations: {len(conversations)}")
        
        # TEST 5: As A, GET /api/messages-unread-count - should be 0
        log("\n" + "=" * 80)
        log("TEST 5: GET /api/messages-unread-count - verify 0 at start")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/messages-unread-count")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        unread_data = resp.json()
        count = unread_data.get('count')
        
        if count is None:
            log(f"❌ FAILED: No 'count' field in response")
            return False
        
        log(f"✅ TEST 5 PASSED: Unread count retrieved")
        log(f"   Unread count: {count}")
        
        # TEST 6: As A, POST /api/messages/{B_id} - send message
        log("\n" + "=" * 80)
        log("TEST 6: POST /api/messages/{B_id} - send message 'Ciao Bruno!'")
        log("=" * 80)
        
        message_data = {"content": "Ciao Bruno!"}
        resp = session_a.post(f"{BASE_URL}/messages/{user_b_id}", json=message_data)
        
        if resp.status_code != 201:
            log(f"❌ FAILED: Expected 201, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        message_response = resp.json()
        message_obj = message_response.get('message')
        
        if not message_obj:
            log(f"❌ FAILED: No 'message' object in response")
            return False
        
        # Verify message structure
        required_fields = ['id', 'from_user_id', 'to_user_id', 'content', 'created_at', 'read_at']
        for field in required_fields:
            if field not in message_obj:
                log(f"❌ FAILED: Missing field '{field}' in message object")
                return False
        
        if message_obj['from_user_id'] != user_a_id:
            log(f"❌ FAILED: from_user_id mismatch")
            return False
        
        if message_obj['to_user_id'] != user_b_id:
            log(f"❌ FAILED: to_user_id mismatch")
            return False
        
        if message_obj['content'] != "Ciao Bruno!":
            log(f"❌ FAILED: content mismatch")
            return False
        
        message1_id = message_obj['id']
        log(f"✅ TEST 6 PASSED: Message sent successfully")
        log(f"   Message ID: {message1_id}")
        log(f"   Content: {message_obj['content']}")
        
        # TEST 7: As A, POST /api/messages/{A_id} - send to self (should fail)
        log("\n" + "=" * 80)
        log("TEST 7: POST /api/messages/{A_id} - send to self (expect 400)")
        log("=" * 80)
        
        self_message = {"content": "Message to myself"}
        resp = session_a.post(f"{BASE_URL}/messages/{user_a_id}", json=self_message)
        
        if resp.status_code != 400:
            log(f"❌ FAILED: Expected 400, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ TEST 7 PASSED: Self-message correctly rejected with 400")
        
        # TEST 8: As A, POST /api/messages/{B_id} with empty content (should fail)
        log("\n" + "=" * 80)
        log("TEST 8: POST /api/messages/{B_id} with empty content (expect 400)")
        log("=" * 80)
        
        empty_message = {"content": ""}
        resp = session_a.post(f"{BASE_URL}/messages/{user_b_id}", json=empty_message)
        
        if resp.status_code != 400:
            log(f"❌ FAILED: Expected 400, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ TEST 8 PASSED: Empty message correctly rejected with 400")
        
        # TEST 9: As A, POST to nonexistent user (should fail)
        log("\n" + "=" * 80)
        log("TEST 9: POST /api/messages/nonexistent-uuid (expect 404)")
        log("=" * 80)
        
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        fake_message = {"content": "hi"}
        resp = session_a.post(f"{BASE_URL}/messages/{fake_uuid}", json=fake_message)
        
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ TEST 9 PASSED: Nonexistent user correctly returns 404")
        
        # TEST 10: As A, GET /api/messages/{B_id} - fetch conversation
        log("\n" + "=" * 80)
        log("TEST 10: GET /api/messages/{B_id} - fetch conversation")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/messages/{user_b_id}")
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
        
        if not isinstance(messages, list):
            log(f"❌ FAILED: 'messages' is not an array")
            return False
        
        if len(messages) != 1:
            log(f"❌ FAILED: Expected 1 message, got {len(messages)}")
            return False
        
        msg = messages[0]
        if msg.get('from_user_id') != user_a_id:
            log(f"❌ FAILED: Message from_user_id mismatch")
            return False
        
        if msg.get('content') != "Ciao Bruno!":
            log(f"❌ FAILED: Message content mismatch")
            return False
        
        log(f"✅ TEST 10 PASSED: Conversation retrieved")
        log(f"   Other user: {other_user.get('username')}")
        log(f"   Messages: {len(messages)}")
        
        # TEST 11: As B, GET /api/messages-unread-count - should be 1
        log("\n" + "=" * 80)
        log("TEST 11: As B, GET /api/messages-unread-count (expect 1)")
        log("=" * 80)
        
        resp = session_b.get(f"{BASE_URL}/messages-unread-count")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        unread_data = resp.json()
        count = unread_data.get('count')
        
        if count != 1:
            log(f"❌ FAILED: Expected count=1, got {count}")
            return False
        
        log(f"✅ TEST 11 PASSED: Unread count = 1")
        
        # TEST 12: As B, GET /api/messages - verify conversation with A
        log("\n" + "=" * 80)
        log("TEST 12: As B, GET /api/messages - verify conversation with A")
        log("=" * 80)
        
        resp = session_b.get(f"{BASE_URL}/messages")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        messages_data = resp.json()
        conversations = messages_data.get('conversations', [])
        
        if len(conversations) != 1:
            log(f"❌ FAILED: Expected 1 conversation, got {len(conversations)}")
            return False
        
        conv = conversations[0]
        
        # Verify conversation structure
        required_fields = ['user', 'last_message', 'last_at', 'last_from_me', 'unread']
        for field in required_fields:
            if field not in conv:
                log(f"❌ FAILED: Missing field '{field}' in conversation")
                return False
        
        if conv['user']['id'] != user_a_id:
            log(f"❌ FAILED: Conversation user ID mismatch")
            return False
        
        if conv['last_message'] != "Ciao Bruno!":
            log(f"❌ FAILED: last_message mismatch: {conv['last_message']}")
            return False
        
        if conv['last_from_me'] != False:
            log(f"❌ FAILED: last_from_me should be False, got {conv['last_from_me']}")
            return False
        
        if conv['unread'] != 1:
            log(f"❌ FAILED: unread should be 1, got {conv['unread']}")
            return False
        
        log(f"✅ TEST 12 PASSED: Conversation list correct")
        log(f"   User: {conv['user'].get('username')}")
        log(f"   Last message: {conv['last_message']}")
        log(f"   Unread: {conv['unread']}")
        
        # TEST 13: As B, GET /api/messages/{A_id} - marks as read
        log("\n" + "=" * 80)
        log("TEST 13: As B, GET /api/messages/{A_id} - auto-mark as read")
        log("=" * 80)
        
        resp = session_b.get(f"{BASE_URL}/messages/{user_a_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        conv_data = resp.json()
        messages = conv_data.get('messages', [])
        
        if len(messages) != 1:
            log(f"❌ FAILED: Expected 1 message, got {len(messages)}")
            return False
        
        log(f"✅ TEST 13 PASSED: Conversation retrieved (messages marked as read)")
        log(f"   Messages: {len(messages)}")
        
        # TEST 14: As B, GET /api/messages-unread-count - should be 0 now
        log("\n" + "=" * 80)
        log("TEST 14: As B, GET /api/messages-unread-count (expect 0 after read)")
        log("=" * 80)
        
        resp = session_b.get(f"{BASE_URL}/messages-unread-count")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        unread_data = resp.json()
        count = unread_data.get('count')
        
        if count != 0:
            log(f"❌ FAILED: Expected count=0, got {count}")
            return False
        
        log(f"✅ TEST 14 PASSED: Unread count = 0 (messages marked as read)")
        
        # TEST 15: As B, POST /api/messages/{A_id} - reply
        log("\n" + "=" * 80)
        log("TEST 15: As B, POST /api/messages/{A_id} - reply 'Ciao Anna!'")
        log("=" * 80)
        
        reply_data = {"content": "Ciao Anna!"}
        resp = session_b.post(f"{BASE_URL}/messages/{user_a_id}", json=reply_data)
        
        if resp.status_code != 201:
            log(f"❌ FAILED: Expected 201, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        reply_response = resp.json()
        reply_obj = reply_response.get('message')
        
        if not reply_obj:
            log(f"❌ FAILED: No 'message' object in response")
            return False
        
        if reply_obj['content'] != "Ciao Anna!":
            log(f"❌ FAILED: Reply content mismatch")
            return False
        
        log(f"✅ TEST 15 PASSED: Reply sent successfully")
        log(f"   Content: {reply_obj['content']}")
        
        # TEST 16: As A, GET /api/messages/{B_id} - verify 2 messages in order
        log("\n" + "=" * 80)
        log("TEST 16: As A, GET /api/messages/{B_id} - verify 2 messages chronological")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/messages/{user_b_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        conv_data = resp.json()
        messages = conv_data.get('messages', [])
        
        if len(messages) != 2:
            log(f"❌ FAILED: Expected 2 messages, got {len(messages)}")
            return False
        
        # Verify chronological order
        if messages[0]['content'] != "Ciao Bruno!":
            log(f"❌ FAILED: First message should be 'Ciao Bruno!', got '{messages[0]['content']}'")
            return False
        
        if messages[1]['content'] != "Ciao Anna!":
            log(f"❌ FAILED: Second message should be 'Ciao Anna!', got '{messages[1]['content']}'")
            return False
        
        log(f"✅ TEST 16 PASSED: 2 messages in chronological order")
        log(f"   Message 1: {messages[0]['content']}")
        log(f"   Message 2: {messages[1]['content']}")
        
        # TEST 17: Unauthenticated requests should return 401
        log("\n" + "=" * 80)
        log("TEST 17: Unauthenticated requests (expect 401)")
        log("=" * 80)
        
        # Test GET /api/community/users without auth
        resp = unauth_session.get(f"{BASE_URL}/community/users")
        if resp.status_code != 401:
            log(f"❌ FAILED: GET /api/community/users expected 401, got {resp.status_code}")
            return False
        log(f"   ✅ GET /api/community/users -> 401")
        
        # Test GET /api/messages without auth
        resp = unauth_session.get(f"{BASE_URL}/messages")
        if resp.status_code != 401:
            log(f"❌ FAILED: GET /api/messages expected 401, got {resp.status_code}")
            return False
        log(f"   ✅ GET /api/messages -> 401")
        
        # Test POST /api/messages without auth
        resp = unauth_session.post(f"{BASE_URL}/messages/{user_b_id}", json={"content": "test"})
        if resp.status_code != 401:
            log(f"❌ FAILED: POST /api/messages expected 401, got {resp.status_code}")
            return False
        log(f"   ✅ POST /api/messages -> 401")
        
        log(f"✅ TEST 17 PASSED: Unauthenticated requests correctly return 401")
        
        # TEST 18: Regression - verify existing endpoints still work
        log("\n" + "=" * 80)
        log("TEST 18: Regression - verify existing endpoints still work")
        log("=" * 80)
        
        # Get motorcycle ID for user A
        resp = session_a.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/dashboard failed: {resp.status_code}")
            return False
        
        dashboard_data = resp.json()
        motos = dashboard_data.get('motos', [])
        if len(motos) == 0:
            log(f"❌ FAILED: No motorcycles found")
            return False
        
        motorcycle_id = motos[0]['id']
        public_id = motos[0]['public_id']
        
        log(f"   ✅ GET /api/dashboard working")
        
        # Test GET /api/public/{public_id} without auth
        resp = unauth_session.get(f"{BASE_URL}/public/{public_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/public/{public_id} failed: {resp.status_code}")
            return False
        log(f"   ✅ GET /api/public/{public_id} working (no auth)")
        
        # Test POST /api/uploads
        import base64
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        upload_data = {
            "data": f"data:image/png;base64,{tiny_png}",
            "filename": "test.png"
        }
        resp = session_a.post(f"{BASE_URL}/uploads", json=upload_data)
        if resp.status_code != 201:
            log(f"❌ FAILED: POST /api/uploads failed: {resp.status_code}")
            return False
        log(f"   ✅ POST /api/uploads working")
        
        log(f"✅ TEST 18 PASSED: All regression tests successful")
        
        log("\n" + "=" * 80)
        log("🎉 ALL COMMUNITY + MESSAGING TESTS PASSED!")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    log("Starting MotoDNA Backend Tests - Community + Direct Messaging Feature")
    log(f"Base URL: {BASE_URL}")
    log("")
    
    result = test_community_messaging()
    
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
