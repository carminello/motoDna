#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Remember Me + Profile Update + Reminder→Maintenance + Admin Visibility
Tests the new bundle of features on MotoDNA backend
"""

import requests
import json
import time
import uuid
import subprocess
from datetime import datetime

BASE_URL = "https://dna-garage.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_remember_me_and_features():
    """Test Remember Me + Profile Update + Reminder→Maintenance + Admin Visibility + Community User Profile"""
    
    log("=" * 80)
    log("TEST: Remember Me + Profile Update + Reminder→Maintenance + Admin Visibility")
    log("=" * 80)
    
    session_a = requests.Session()
    session_b = requests.Session()
    unauth_session = requests.Session()
    
    user_a_email = None
    user_b_email = None
    user_a_id = None
    user_b_id = None
    motorcycle_id = None
    public_id = None
    
    try:
        # ============== TEST 1: LOGIN + REMEMBER ME ==============
        log("\n" + "=" * 80)
        log("TEST 1: LOGIN + REMEMBER ME")
        log("=" * 80)
        
        # Register user A with fresh random email/password
        timestamp = int(time.time())
        user_a_email = f"testuser_remember_{timestamp}@motodna.test"
        user_a_password = "SecurePass123!"
        
        register_a = {
            "email": user_a_email,
            "password": user_a_password,
            "first_name": "Alessandro",
            "last_name": "Rossi",
            "username": f"alex_{timestamp}"
        }
        
        log(f"\n   Registering User A: {user_a_email}")
        resp = session_a.post(f"{BASE_URL}/auth/register", json=register_a)
        if resp.status_code != 200:
            log(f"❌ FAILED: User A registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_a_data = resp.json().get('user', {})
        user_a_id = user_a_data.get('id')
        log(f"   ✅ User A registered: {user_a_id}")
        
        # Save cookie jar A1
        cookies_a1 = session_a.cookies.copy()
        
        # Logout
        log(f"\n   Logging out User A...")
        resp = session_a.post(f"{BASE_URL}/auth/logout")
        if resp.status_code != 200:
            log(f"❌ FAILED: Logout failed: {resp.status_code}")
            return False
        log(f"   ✅ User A logged out")
        
        # Login with remember: true
        log(f"\n   Login with remember=true...")
        login_data = {
            "email": user_a_email,
            "password": user_a_password,
            "remember": True
        }
        
        resp = session_a.post(f"{BASE_URL}/auth/login", json=login_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: Login with remember=true failed: {resp.status_code} - {resp.text}")
            return False
        
        # Verify Set-Cookie header contains Max-Age attribute (~7776000 seconds = 90 days)
        set_cookie_header = resp.headers.get('Set-Cookie', '')
        log(f"   Set-Cookie header: {set_cookie_header}")
        
        if 'Max-Age' not in set_cookie_header and 'max-age' not in set_cookie_header.lower():
            log(f"❌ FAILED: Set-Cookie header does NOT contain Max-Age attribute for remember=true")
            return False
        
        # Check if Max-Age is approximately 90 days (7776000 seconds)
        # Allow some tolerance (between 7 days and 100 days)
        if 'max-age=' in set_cookie_header.lower():
            import re
            match = re.search(r'max-age=(\d+)', set_cookie_header, re.IGNORECASE)
            if match:
                max_age = int(match.group(1))
                log(f"   Max-Age value: {max_age} seconds ({max_age / 86400:.1f} days)")
                
                # Verify it's approximately 90 days (allow 7-100 days range)
                if max_age < 7 * 86400 or max_age > 100 * 86400:
                    log(f"❌ FAILED: Max-Age {max_age} is not in expected range (7-100 days)")
                    return False
        
        # Verify response body includes is_admin (false for A)
        login_response = resp.json()
        user_data = login_response.get('user', {})
        is_admin = user_data.get('is_admin')
        
        if is_admin is None:
            log(f"❌ FAILED: Response body does NOT include is_admin field")
            return False
        
        if is_admin != False:
            log(f"❌ FAILED: is_admin should be False for non-admin user, got {is_admin}")
            return False
        
        log(f"   ✅ Login with remember=true successful")
        log(f"   ✅ Set-Cookie contains Max-Age attribute (~90 days)")
        log(f"   ✅ Response includes is_admin=False")
        
        # Logout again
        log(f"\n   Logging out User A...")
        resp = session_a.post(f"{BASE_URL}/auth/logout")
        if resp.status_code != 200:
            log(f"❌ FAILED: Logout failed: {resp.status_code}")
            return False
        
        # Login with remember: false
        log(f"\n   Login with remember=false...")
        login_data = {
            "email": user_a_email,
            "password": user_a_password,
            "remember": False
        }
        
        resp = session_a.post(f"{BASE_URL}/auth/login", json=login_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: Login with remember=false failed: {resp.status_code} - {resp.text}")
            return False
        
        # Verify Set-Cookie header does NOT include Max-Age attribute (session cookie)
        set_cookie_header = resp.headers.get('Set-Cookie', '')
        log(f"   Set-Cookie header: {set_cookie_header}")
        
        if 'Max-Age' in set_cookie_header or 'max-age' in set_cookie_header.lower():
            log(f"❌ FAILED: Set-Cookie header contains Max-Age attribute for remember=false (should be session cookie)")
            return False
        
        log(f"   ✅ Login with remember=false successful")
        log(f"   ✅ Set-Cookie does NOT contain Max-Age (session cookie)")
        
        # Test wrong password
        log(f"\n   Testing wrong password...")
        login_data = {
            "email": user_a_email,
            "password": "WRONG_PASSWORD",
            "remember": False
        }
        
        resp = session_a.post(f"{BASE_URL}/auth/login", json=login_data)
        if resp.status_code != 401:
            log(f"❌ FAILED: Expected 401 for wrong password, got {resp.status_code}")
            return False
        
        error_data = resp.json()
        error_msg = error_data.get('error', '')
        
        if error_msg != 'Credenziali non valide':
            log(f"❌ FAILED: Expected error 'Credenziali non valide', got '{error_msg}'")
            return False
        
        log(f"   ✅ Wrong password correctly returns 401 with 'Credenziali non valide'")
        
        log(f"\n✅ TEST 1 PASSED: LOGIN + REMEMBER ME working correctly")
        
        # Re-login with correct credentials for subsequent tests
        login_data = {
            "email": user_a_email,
            "password": user_a_password,
            "remember": True
        }
        resp = session_a.post(f"{BASE_URL}/auth/login", json=login_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: Re-login failed: {resp.status_code}")
            return False
        
        # ============== TEST 2: PROFILE UPDATE ==============
        log("\n" + "=" * 80)
        log("TEST 2: PROFILE UPDATE")
        log("=" * 80)
        
        # PUT /api/auth/me with profile updates
        log(f"\n   Updating profile: first_name, profile_photo, country...")
        update_data = {
            "first_name": "Marco",
            "profile_photo": "https://example.com/a.png",
            "country": "Italia"
        }
        
        resp = session_a.put(f"{BASE_URL}/auth/me", json=update_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: PUT /api/auth/me failed: {resp.status_code} - {resp.text}")
            return False
        
        update_response = resp.json()
        updated_user = update_response.get('user', {})
        
        # Verify NO password_hash in response
        if 'password_hash' in updated_user:
            log(f"❌ FAILED: Response contains password_hash (security issue!)")
            return False
        
        # Verify updated values
        if updated_user.get('first_name') != 'Marco':
            log(f"❌ FAILED: first_name not updated, got {updated_user.get('first_name')}")
            return False
        
        if updated_user.get('profile_photo') != 'https://example.com/a.png':
            log(f"❌ FAILED: profile_photo not updated, got {updated_user.get('profile_photo')}")
            return False
        
        if updated_user.get('country') != 'Italia':
            log(f"❌ FAILED: country not updated, got {updated_user.get('country')}")
            return False
        
        log(f"   ✅ Profile updated successfully")
        log(f"   ✅ NO password_hash in response")
        
        # GET /api/auth/me to verify updates persisted
        log(f"\n   Verifying updates with GET /api/auth/me...")
        resp = session_a.get(f"{BASE_URL}/auth/me")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/auth/me failed: {resp.status_code}")
            return False
        
        me_response = resp.json()
        me_user = me_response.get('user', {})
        
        if me_user.get('first_name') != 'Marco':
            log(f"❌ FAILED: first_name not persisted, got {me_user.get('first_name')}")
            return False
        
        if me_user.get('profile_photo') != 'https://example.com/a.png':
            log(f"❌ FAILED: profile_photo not persisted, got {me_user.get('profile_photo')}")
            return False
        
        if me_user.get('country') != 'Italia':
            log(f"❌ FAILED: country not persisted, got {me_user.get('country')}")
            return False
        
        log(f"   ✅ Updates persisted correctly")
        
        # Update username
        log(f"\n   Updating username...")
        new_username = f"newuser_abc123_{timestamp}"
        update_data = {
            "username": new_username
        }
        
        resp = session_a.put(f"{BASE_URL}/auth/me", json=update_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: PUT /api/auth/me (username) failed: {resp.status_code} - {resp.text}")
            return False
        
        update_response = resp.json()
        updated_user = update_response.get('user', {})
        
        if updated_user.get('username') != new_username:
            log(f"❌ FAILED: username not updated, got {updated_user.get('username')}")
            return False
        
        log(f"   ✅ Username updated to: {new_username}")
        
        log(f"\n✅ TEST 2 PASSED: PROFILE UPDATE working correctly")
        
        # ============== TEST 3: REMINDER → MAINTENANCE ==============
        log("\n" + "=" * 80)
        log("TEST 3: REMINDER → MAINTENANCE")
        log("=" * 80)
        
        # Get motorcycle_id from GET /api/dashboard
        log(f"\n   Getting motorcycle_id from dashboard...")
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
        log(f"   ✅ motorcycle_id: {motorcycle_id}")
        log(f"   ✅ public_id: {public_id}")
        
        # Create a NON-recurring reminder
        log(f"\n   Creating NON-recurring reminder...")
        reminder_data = {
            "title": "Cambio filtro aria",
            "target_mileage": 20000
        }
        
        resp = session_a.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/reminders", json=reminder_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: POST reminder failed: {resp.status_code} - {resp.text}")
            return False
        
        reminder_response = resp.json()
        reminder_r1 = reminder_response.get('item', {})
        reminder_r1_id = reminder_r1.get('id')
        
        log(f"   ✅ NON-recurring reminder R1 created: {reminder_r1_id}")
        log(f"      Title: {reminder_r1.get('title')}")
        log(f"      Target mileage: {reminder_r1.get('target_mileage')}")
        
        # Complete the NON-recurring reminder
        log(f"\n   Completing NON-recurring reminder R1...")
        resp = session_a.post(f"{BASE_URL}/reminders/{reminder_r1_id}/complete", json={})
        if resp.status_code not in [200, 201]:
            log(f"❌ FAILED: POST /api/reminders/{reminder_r1_id}/complete failed: {resp.status_code} - {resp.text}")
            return False
        
        complete_response = resp.json()
        maintenance = complete_response.get('maintenance', {})
        
        # Verify maintenance object
        if not maintenance.get('id'):
            log(f"❌ FAILED: Maintenance object missing id")
            return False
        
        if maintenance.get('motorcycle_id') != motorcycle_id:
            log(f"❌ FAILED: Maintenance motorcycle_id mismatch")
            return False
        
        if maintenance.get('service_type') != 'OTHER':
            log(f"❌ FAILED: Maintenance service_type should be 'OTHER', got {maintenance.get('service_type')}")
            return False
        
        if maintenance.get('title') != 'Cambio filtro aria':
            log(f"❌ FAILED: Maintenance title mismatch, got {maintenance.get('title')}")
            return False
        
        if maintenance.get('mileage') != 20000:
            log(f"❌ FAILED: Maintenance mileage should be 20000, got {maintenance.get('mileage')}")
            return False
        
        if maintenance.get('from_reminder_id') != reminder_r1_id:
            log(f"❌ FAILED: Maintenance from_reminder_id mismatch")
            return False
        
        log(f"   ✅ Maintenance created from reminder R1")
        log(f"      Maintenance ID: {maintenance.get('id')}")
        log(f"      Title: {maintenance.get('title')}")
        log(f"      Mileage: {maintenance.get('mileage')}")
        log(f"      from_reminder_id: {maintenance.get('from_reminder_id')}")
        
        # Verify reminder R1 is marked as DONE
        log(f"\n   Verifying reminder R1 status...")
        resp = session_a.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/motorcycles/{motorcycle_id} failed: {resp.status_code}")
            return False
        
        moto_data = resp.json()
        reminders = moto_data.get('reminders', [])
        maintenance_list = moto_data.get('maintenance', [])
        
        # Find R1 in reminders
        r1_found = None
        for r in reminders:
            if r.get('id') == reminder_r1_id:
                r1_found = r
                break
        
        if not r1_found:
            log(f"❌ FAILED: Reminder R1 not found in reminders list")
            return False
        
        if r1_found.get('status') != 'DONE':
            log(f"❌ FAILED: Reminder R1 status should be 'DONE', got {r1_found.get('status')}")
            return False
        
        if not r1_found.get('completed_at'):
            log(f"❌ FAILED: Reminder R1 completed_at not set")
            return False
        
        log(f"   ✅ Reminder R1 status: DONE")
        log(f"   ✅ Reminder R1 completed_at: {r1_found.get('completed_at')}")
        
        # Verify maintenance entry exists with from_reminder_id
        maintenance_found = None
        for m in maintenance_list:
            if m.get('from_reminder_id') == reminder_r1_id:
                maintenance_found = m
                break
        
        if not maintenance_found:
            log(f"❌ FAILED: Maintenance with from_reminder_id={reminder_r1_id} not found")
            return False
        
        log(f"   ✅ Maintenance entry found with from_reminder_id={reminder_r1_id}")
        
        # Create a RECURRING reminder
        log(f"\n   Creating RECURRING reminder...")
        reminder_data = {
            "title": "Cambio olio",
            "repeat_interval_km": 3000
        }
        
        resp = session_a.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/reminders", json=reminder_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: POST recurring reminder failed: {resp.status_code} - {resp.text}")
            return False
        
        reminder_response = resp.json()
        reminder_r2 = reminder_response.get('item', {})
        reminder_r2_id = reminder_r2.get('id')
        
        log(f"   ✅ RECURRING reminder R2 created: {reminder_r2_id}")
        log(f"      Title: {reminder_r2.get('title')}")
        log(f"      repeat_interval_km: {reminder_r2.get('repeat_interval_km')}")
        
        # Complete the RECURRING reminder with mileage 15000
        log(f"\n   Completing RECURRING reminder R2 with mileage=15000...")
        resp = session_a.post(f"{BASE_URL}/reminders/{reminder_r2_id}/complete", json={"mileage": 15000})
        if resp.status_code not in [200, 201]:
            log(f"❌ FAILED: POST /api/reminders/{reminder_r2_id}/complete failed: {resp.status_code} - {resp.text}")
            return False
        
        complete_response = resp.json()
        maintenance_r2 = complete_response.get('maintenance', {})
        
        log(f"   ✅ Maintenance created from recurring reminder R2")
        log(f"      Maintenance ID: {maintenance_r2.get('id')}")
        log(f"      Mileage: {maintenance_r2.get('mileage')}")
        
        # Verify R2 still exists with target_mileage=18000 (15000+3000)
        log(f"\n   Verifying recurring reminder R2 rebased...")
        resp = session_a.get(f"{BASE_URL}/motorcycles/{motorcycle_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/motorcycles/{motorcycle_id} failed: {resp.status_code}")
            return False
        
        moto_data = resp.json()
        reminders = moto_data.get('reminders', [])
        
        # Find R2 in reminders
        r2_found = None
        for r in reminders:
            if r.get('id') == reminder_r2_id:
                r2_found = r
                break
        
        if not r2_found:
            log(f"❌ FAILED: Recurring reminder R2 not found (should still exist)")
            return False
        
        expected_target = 15000 + 3000  # 18000
        if r2_found.get('target_mileage') != expected_target:
            log(f"❌ FAILED: R2 target_mileage should be {expected_target}, got {r2_found.get('target_mileage')}")
            return False
        
        if not r2_found.get('last_completed_at'):
            log(f"❌ FAILED: R2 last_completed_at not set")
            return False
        
        log(f"   ✅ Recurring reminder R2 still exists")
        log(f"   ✅ R2 target_mileage rebased to: {r2_found.get('target_mileage')}")
        log(f"   ✅ R2 last_completed_at: {r2_found.get('last_completed_at')}")
        
        # Test completing non-existent reminder
        log(f"\n   Testing non-existent reminder...")
        fake_reminder_id = str(uuid.uuid4())
        resp = session_a.post(f"{BASE_URL}/reminders/{fake_reminder_id}/complete", json={})
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404 for non-existent reminder, got {resp.status_code}")
            return False
        
        log(f"   ✅ Non-existent reminder returns 404")
        
        # Register user B to test scoping
        log(f"\n   Registering User B to test reminder scoping...")
        user_b_email = f"testuser_b_{timestamp}@motodna.test"
        register_b = {
            "email": user_b_email,
            "password": "SecurePass456!",
            "first_name": "Bruno",
            "last_name": "Bianchi",
            "username": f"bruno_{timestamp}"
        }
        
        resp = session_b.post(f"{BASE_URL}/auth/register", json=register_b)
        if resp.status_code != 200:
            log(f"❌ FAILED: User B registration failed: {resp.status_code}")
            return False
        
        user_b_data = resp.json().get('user', {})
        user_b_id = user_b_data.get('id')
        log(f"   ✅ User B registered: {user_b_id}")
        
        # Try to complete R1 as user B (should fail with 404 - scoped to user_id)
        log(f"\n   Testing reminder scoping (User B tries to complete User A's reminder)...")
        resp = session_b.post(f"{BASE_URL}/reminders/{reminder_r1_id}/complete", json={})
        if resp.status_code != 404:
            log(f"❌ FAILED: Expected 404 when User B tries to complete User A's reminder, got {resp.status_code}")
            return False
        
        log(f"   ✅ User B correctly denied access to User A's reminder (404)")
        
        log(f"\n✅ TEST 3 PASSED: REMINDER → MAINTENANCE working correctly")
        
        # ============== TEST 4: ADMIN VISIBILITY ==============
        log("\n" + "=" * 80)
        log("TEST 4: ADMIN VISIBILITY")
        log("=" * 80)
        
        # Promote User B to admin
        log(f"\n   Promoting User B to admin...")
        try:
            result = subprocess.run(
                ['node', '/app/scripts/promote_admin.js', user_b_email],
                capture_output=True,
                text=True,
                timeout=10,
                cwd='/app'
            )
            
            if result.returncode != 0:
                log(f"❌ FAILED: promote_admin.js failed: {result.stderr}")
                return False
            
            log(f"   ✅ User B promoted to admin")
        except Exception as e:
            log(f"❌ FAILED: Error running promote_admin.js: {str(e)}")
            return False
        
        # GET /api/auth/me as User B (admin)
        log(f"\n   Verifying is_admin=true for User B...")
        resp = session_b.get(f"{BASE_URL}/auth/me")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/auth/me failed: {resp.status_code}")
            return False
        
        me_response = resp.json()
        me_user = me_response.get('user', {})
        is_admin = me_user.get('is_admin')
        
        if is_admin != True:
            log(f"❌ FAILED: is_admin should be True for promoted user, got {is_admin}")
            return False
        
        log(f"   ✅ User B is_admin=True")
        
        # GET /api/auth/me as User A (non-admin)
        log(f"\n   Verifying is_admin=false for User A...")
        resp = session_a.get(f"{BASE_URL}/auth/me")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/auth/me failed: {resp.status_code}")
            return False
        
        me_response = resp.json()
        me_user = me_response.get('user', {})
        is_admin = me_user.get('is_admin')
        
        if is_admin not in [False, None]:
            log(f"❌ FAILED: is_admin should be False or absent for non-admin user, got {is_admin}")
            return False
        
        log(f"   ✅ User A is_admin={is_admin} (non-admin)")
        
        log(f"\n✅ TEST 4 PASSED: ADMIN VISIBILITY working correctly")
        
        # ============== TEST 5: COMMUNITY USER PROFILE ==============
        log("\n" + "=" * 80)
        log("TEST 5: COMMUNITY USER PROFILE")
        log("=" * 80)
        
        # GET /api/community/users/{A_id} as User B
        log(f"\n   Getting User A's community profile as User B...")
        resp = session_b.get(f"{BASE_URL}/community/users/{user_a_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/community/users/{user_a_id} failed: {resp.status_code} - {resp.text}")
            return False
        
        profile_response = resp.json()
        user_profile = profile_response.get('user', {})
        bikes = profile_response.get('bikes', [])
        
        # Verify user object does NOT include email or password_hash
        if 'email' in user_profile:
            log(f"❌ FAILED: User profile exposes email (privacy issue!)")
            return False
        
        if 'password_hash' in user_profile:
            log(f"❌ FAILED: User profile exposes password_hash (security issue!)")
            return False
        
        log(f"   ✅ User profile does NOT expose email or password_hash")
        log(f"   ✅ User profile: {user_profile.get('username')}")
        log(f"   ✅ Bikes count: {len(bikes)}")
        
        # Verify bikes array only contains public_profile:true bikes
        # First, set one bike to private
        if len(bikes) > 0:
            log(f"\n   Setting User A's bike to private to test filtering...")
            resp = session_a.put(f"{BASE_URL}/motorcycles/{motorcycle_id}", json={"public_profile": False})
            if resp.status_code != 200:
                log(f"❌ FAILED: PUT motorcycle failed: {resp.status_code}")
                return False
            
            log(f"   ✅ Bike set to private")
            
            # Re-fetch community profile
            resp = session_b.get(f"{BASE_URL}/community/users/{user_a_id}")
            if resp.status_code != 200:
                log(f"❌ FAILED: GET /api/community/users/{user_a_id} failed: {resp.status_code}")
                return False
            
            profile_response = resp.json()
            bikes = profile_response.get('bikes', [])
            
            # Should be empty now (no public bikes)
            if len(bikes) != 0:
                log(f"❌ FAILED: Bikes array should be empty (bike is private), got {len(bikes)} bikes")
                return False
            
            log(f"   ✅ Private bike correctly excluded from community profile")
            
            # Set bike back to public
            resp = session_a.put(f"{BASE_URL}/motorcycles/{motorcycle_id}", json={"public_profile": True})
            if resp.status_code != 200:
                log(f"❌ FAILED: PUT motorcycle failed: {resp.status_code}")
                return False
        
        log(f"\n✅ TEST 5 PASSED: COMMUNITY USER PROFILE working correctly")
        
        # ============== TEST 6: REGRESSION ==============
        log("\n" + "=" * 80)
        log("TEST 6: REGRESSION TESTS")
        log("=" * 80)
        
        # GET /api/public/{public_id} (no auth)
        log(f"\n   Testing GET /api/public/{public_id} (no auth)...")
        resp = unauth_session.get(f"{BASE_URL}/public/{public_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/public/{public_id} failed: {resp.status_code}")
            return False
        
        log(f"   ✅ GET /api/public/{public_id} working")
        
        # GET /api/messages (as A)
        log(f"\n   Testing GET /api/messages (as User A)...")
        resp = session_a.get(f"{BASE_URL}/messages")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/messages failed: {resp.status_code}")
            return False
        
        log(f"   ✅ GET /api/messages working")
        
        # POST /api/motorcycles/{motorcycle_id}/nfc/associate (as A)
        log(f"\n   Testing POST /api/motorcycles/{motorcycle_id}/nfc/associate (as User A)...")
        nfc_data = {
            "tag_uid": "04:aa:bb:cc:test"
        }
        resp = session_a.post(f"{BASE_URL}/motorcycles/{motorcycle_id}/nfc/associate", json=nfc_data)
        if resp.status_code != 200:
            log(f"❌ FAILED: POST /api/motorcycles/{motorcycle_id}/nfc/associate failed: {resp.status_code} - {resp.text}")
            return False
        
        log(f"   ✅ POST /api/motorcycles/{motorcycle_id}/nfc/associate working")
        
        log(f"\n✅ TEST 6 PASSED: All regression tests successful")
        
        log("\n" + "=" * 80)
        log("🎉 ALL TESTS PASSED!")
        log("=" * 80)
        
        return True
        
    except Exception as e:
        log(f"\n❌ TEST EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup: Delete test users from database
        log("\n" + "=" * 80)
        log("CLEANUP: Deleting test users from database")
        log("=" * 80)
        
        # Do NOT delete carminellout@gmail.com
        if user_a_email or user_b_email:
            try:
                cleanup_script = f"""
const {{ MongoClient }} = require('/app/node_modules/mongodb');
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'motodna';

(async () => {{
  const c = new MongoClient(MONGO_URL);
  await c.connect();
  const db = c.db(DB_NAME);
  
  const emails = [];
  if ('{user_a_email}') emails.push('{user_a_email}');
  if ('{user_b_email}') emails.push('{user_b_email}');
  
  // Filter out carminellout@gmail.com
  const filteredEmails = emails.filter(e => e !== 'carminellout@gmail.com');
  
  if (filteredEmails.length === 0) {{
    console.log('No test users to delete');
    await c.close();
    return;
  }}
  
  // Find user IDs
  const users = await db.collection('users').find({{ email: {{ $in: filteredEmails }} }}).toArray();
  const userIds = users.map(u => u.id);
  
  if (userIds.length === 0) {{
    console.log('No test users found to delete');
    await c.close();
    return;
  }}
  
  console.log(`Deleting ${{userIds.length}} test users: ${{filteredEmails.join(', ')}}`);
  
  // Find motorcycles owned by these users
  const motos = await db.collection('motorcycles').find({{ owner_id: {{ $in: userIds }} }}).toArray();
  const motoIds = motos.map(m => m.id);
  
  // Delete all related data
  if (motoIds.length > 0) {{
    await db.collection('maintenance').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('timeline').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('modifications').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('gallery').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('documents').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('reminders').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('nfc_tags').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('nfc_scans').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('postits').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('ownership_history').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('transfers').deleteMany({{ motorcycle_id: {{ $in: motoIds }} }});
    await db.collection('motorcycles').deleteMany({{ id: {{ $in: motoIds }} }});
  }}
  
  // Delete messages
  await db.collection('messages').deleteMany({{ $or: [
    {{ from_user_id: {{ $in: userIds }} }},
    {{ to_user_id: {{ $in: userIds }} }}
  ] }});
  
  // Delete users
  const result = await db.collection('users').deleteMany({{ id: {{ $in: userIds }} }});
  console.log(`Deleted ${{result.deletedCount}} users`);
  
  await c.close();
}})().catch(e => {{ console.error(e); process.exit(1); }});
"""
                
                # Write cleanup script to temp file
                with open('/tmp/cleanup_test_users.js', 'w') as f:
                    f.write(cleanup_script)
                
                # Run cleanup script
                result = subprocess.run(
                    ['node', '/tmp/cleanup_test_users.js'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    log(f"✅ Cleanup successful")
                    log(f"   {result.stdout.strip()}")
                else:
                    log(f"⚠️  Cleanup script failed: {result.stderr}")
                    
            except Exception as e:
                log(f"⚠️  Cleanup error: {str(e)}")

if __name__ == "__main__":
    log("Starting MotoDNA Backend Tests - Remember Me + Profile Update + Reminder→Maintenance + Admin Visibility")
    log(f"Base URL: {BASE_URL}")
    log("")
    
    result = test_remember_me_and_features()
    
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
