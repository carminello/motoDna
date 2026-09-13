#!/usr/bin/env python3
"""
MotoDNA Backend API Test - Admin Dashboard Feature
Tests the new admin dashboard with stats, user growth chart, and admin gating
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

def test_admin_dashboard():
    """Test Admin Dashboard feature end-to-end"""
    
    log("=" * 80)
    log("TEST: Admin Dashboard Feature")
    log("=" * 80)
    
    session_a = requests.Session()
    session_b = requests.Session()
    unauth_session = requests.Session()
    
    user_a_email = None
    user_b_email = None
    
    try:
        # TEST 1: Without auth cookie, GET /api/admin/stats → 401
        log("\n" + "=" * 80)
        log("TEST 1: GET /api/admin/stats without auth (expect 401)")
        log("=" * 80)
        
        resp = unauth_session.get(f"{BASE_URL}/admin/stats")
        if resp.status_code != 401:
            log(f"❌ FAILED: Expected 401, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        log(f"✅ TEST 1 PASSED: Unauthenticated request returns 401")
        
        # Get initial user count before registrations
        log("\n" + "=" * 80)
        log("SETUP: Get initial user count")
        log("=" * 80)
        
        # We need to use an existing admin to get the initial count
        # carminellout@gmail.com is already promoted to admin
        admin_session = requests.Session()
        admin_login = {
            "email": "carminellout@gmail.com",
            "password": "test123"  # Assuming this is the password
        }
        
        # Try to login as existing admin (if exists)
        resp = admin_session.post(f"{BASE_URL}/auth/login", json=admin_login)
        initial_total_users = None
        
        if resp.status_code == 200:
            # Get initial stats
            resp = admin_session.get(f"{BASE_URL}/admin/stats")
            if resp.status_code == 200:
                stats_data = resp.json()
                initial_total_users = stats_data.get('stats', {}).get('total_users', 0)
                log(f"   Initial total_users: {initial_total_users}")
        
        # SETUP: Register user A (non-admin)
        log("\n" + "=" * 80)
        log("SETUP: Register User A (non-admin)")
        log("=" * 80)
        
        timestamp = int(time.time())
        user_a_email = f"testuser_a_{timestamp}@motodna.test"
        
        register_a = {
            "email": user_a_email,
            "password": "SecurePass123!",
            "first_name": "Marco",
            "last_name": "Verdi",
            "username": f"marco_{timestamp}"
        }
        
        resp = session_a.post(f"{BASE_URL}/auth/register", json=register_a)
        if resp.status_code != 200:
            log(f"❌ FAILED: User A registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_a_data = resp.json().get('user', {})
        user_a_id = user_a_data.get('id')
        log(f"✅ User A registered: {user_a_id}")
        log(f"   Email: {user_a_email}")
        log(f"   Username: {user_a_data.get('username')}")
        
        # Get user A's public_id for regression tests
        resp = session_a.get(f"{BASE_URL}/dashboard")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/dashboard failed: {resp.status_code}")
            return False
        
        dashboard_data = resp.json()
        motos = dashboard_data.get('motos', [])
        if len(motos) == 0:
            log(f"❌ FAILED: No motorcycles found for user A")
            return False
        
        user_a_public_id = motos[0]['public_id']
        log(f"   User A's public_id: {user_a_public_id}")
        
        # TEST 2: As A (non-admin), GET /api/admin/stats → 403
        log("\n" + "=" * 80)
        log("TEST 2: As User A (non-admin), GET /api/admin/stats (expect 403)")
        log("=" * 80)
        
        resp = session_a.get(f"{BASE_URL}/admin/stats")
        if resp.status_code != 403:
            log(f"❌ FAILED: Expected 403, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        error_data = resp.json()
        error_msg = error_data.get('error', '')
        
        if error_msg != "Accesso riservato agli admin":
            log(f"❌ FAILED: Expected error message 'Accesso riservato agli admin', got '{error_msg}'")
            return False
        
        log(f"✅ TEST 2 PASSED: Non-admin user correctly denied with 403")
        log(f"   Error message: {error_msg}")
        
        # SETUP: Register user B and promote to admin
        log("\n" + "=" * 80)
        log("SETUP: Register User B and promote to admin")
        log("=" * 80)
        
        user_b_email = f"testuser_b_{timestamp}@motodna.test"
        
        register_b = {
            "email": user_b_email,
            "password": "SecurePass456!",
            "first_name": "Giulia",
            "last_name": "Neri",
            "username": f"giulia_{timestamp}"
        }
        
        resp = session_b.post(f"{BASE_URL}/auth/register", json=register_b)
        if resp.status_code != 200:
            log(f"❌ FAILED: User B registration failed: {resp.status_code} - {resp.text}")
            return False
        
        user_b_data = resp.json().get('user', {})
        user_b_id = user_b_data.get('id')
        log(f"✅ User B registered: {user_b_id}")
        log(f"   Email: {user_b_email}")
        log(f"   Username: {user_b_data.get('username')}")
        
        # Promote user B to admin using the script
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
            log(f"   Script output: {result.stdout.strip()}")
        except Exception as e:
            log(f"❌ FAILED: Error running promote_admin.js: {str(e)}")
            return False
        
        # TEST 3: As B (admin), GET /api/admin/stats → 200 with proper structure
        log("\n" + "=" * 80)
        log("TEST 3: As User B (admin), GET /api/admin/stats (expect 200)")
        log("=" * 80)
        
        resp = session_b.get(f"{BASE_URL}/admin/stats")
        if resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        
        stats_response = resp.json()
        
        # Verify response structure
        if 'stats' not in stats_response:
            log(f"❌ FAILED: Missing 'stats' object in response")
            return False
        
        if 'chart_registrations_30d' not in stats_response:
            log(f"❌ FAILED: Missing 'chart_registrations_30d' array in response")
            return False
        
        if 'recent_users' not in stats_response:
            log(f"❌ FAILED: Missing 'recent_users' array in response")
            return False
        
        stats = stats_response['stats']
        chart = stats_response['chart_registrations_30d']
        recent_users = stats_response['recent_users']
        
        # Verify stats object has all required keys
        required_stats_keys = [
            'total_users', 'new_today', 'new_7d', 'total_bikes', 'total_postits',
            'total_messages', 'online_24h', 'total_scans', 'total_gallery',
            'total_maintenance', 'total_timeline', 'total_modifications'
        ]
        
        for key in required_stats_keys:
            if key not in stats:
                log(f"❌ FAILED: Missing key '{key}' in stats object")
                return False
            
            value = stats[key]
            if not isinstance(value, (int, float)) or value < 0:
                log(f"❌ FAILED: stats.{key} is not a non-negative number: {value}")
                return False
        
        log(f"✅ TEST 3 PASSED: Admin stats endpoint returns 200 with proper structure")
        log(f"   Stats keys verified: {len(required_stats_keys)}")
        log(f"   total_users: {stats['total_users']}")
        log(f"   new_today: {stats['new_today']}")
        log(f"   new_7d: {stats['new_7d']}")
        log(f"   total_bikes: {stats['total_bikes']}")
        log(f"   total_postits: {stats['total_postits']}")
        log(f"   total_messages: {stats['total_messages']}")
        log(f"   online_24h: {stats['online_24h']}")
        log(f"   total_scans: {stats['total_scans']}")
        log(f"   total_gallery: {stats['total_gallery']}")
        log(f"   total_maintenance: {stats['total_maintenance']}")
        log(f"   total_timeline: {stats['total_timeline']}")
        log(f"   total_modifications: {stats['total_modifications']}")
        
        # Verify chart_registrations_30d structure
        log("\n   Verifying chart_registrations_30d structure...")
        
        if not isinstance(chart, list):
            log(f"❌ FAILED: chart_registrations_30d is not an array")
            return False
        
        if len(chart) != 30:
            log(f"❌ FAILED: chart_registrations_30d should have exactly 30 items, got {len(chart)}")
            return False
        
        for i, item in enumerate(chart):
            if 'date' not in item or 'label' not in item or 'users' not in item:
                log(f"❌ FAILED: chart item {i} missing required fields (date, label, users)")
                return False
            
            # Verify date format YYYY-MM-DD
            date_str = item['date']
            if not isinstance(date_str, str) or len(date_str) != 10:
                log(f"❌ FAILED: chart item {i} date format invalid: {date_str}")
                return False
            
            # Verify users is a number
            if not isinstance(item['users'], (int, float)) or item['users'] < 0:
                log(f"❌ FAILED: chart item {i} users is not a non-negative number: {item['users']}")
                return False
        
        log(f"   ✅ chart_registrations_30d: {len(chart)} items, all valid")
        log(f"   Sample: {chart[-1]}")  # Last day (today)
        
        # Verify recent_users structure
        log("\n   Verifying recent_users structure...")
        
        if not isinstance(recent_users, list):
            log(f"❌ FAILED: recent_users is not an array")
            return False
        
        if len(recent_users) > 10:
            log(f"❌ FAILED: recent_users should have at most 10 items, got {len(recent_users)}")
            return False
        
        for i, user in enumerate(recent_users):
            # Verify password_hash is NOT present
            if 'password_hash' in user:
                log(f"❌ FAILED: recent_users[{i}] contains password_hash (security issue!)")
                return False
            
            # Verify required fields
            if 'id' not in user or 'username' not in user or 'email' not in user:
                log(f"❌ FAILED: recent_users[{i}] missing required fields")
                return False
        
        log(f"   ✅ recent_users: {len(recent_users)} items, no password_hash exposed")
        
        # TEST 4: online_24h tracking
        log("\n" + "=" * 80)
        log("TEST 4: online_24h tracking - hit /api/auth/me as A, then check stats")
        log("=" * 80)
        
        # Hit /api/auth/me as user A to update last_seen
        resp = session_a.get(f"{BASE_URL}/auth/me")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/auth/me failed: {resp.status_code}")
            return False
        
        log(f"   ✅ User A hit /api/auth/me (last_seen updated)")
        
        # Re-fetch stats as admin B
        resp = session_b.get(f"{BASE_URL}/admin/stats")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/admin/stats failed: {resp.status_code}")
            return False
        
        stats_response = resp.json()
        online_24h = stats_response['stats']['online_24h']
        
        # online_24h should be at least 1 (user A just accessed)
        if online_24h < 1:
            log(f"❌ FAILED: online_24h should be >= 1, got {online_24h}")
            return False
        
        log(f"✅ TEST 4 PASSED: online_24h tracking working")
        log(f"   online_24h: {online_24h} (includes User A)")
        
        # TEST 5: new_today count
        log("\n" + "=" * 80)
        log("TEST 5: new_today count - verify increased by 2 after registrations")
        log("=" * 80)
        
        current_total_users = stats_response['stats']['total_users']
        new_today = stats_response['stats']['new_today']
        
        # new_today should be at least 2 (user A and user B registered today)
        if new_today < 2:
            log(f"❌ FAILED: new_today should be >= 2, got {new_today}")
            return False
        
        log(f"✅ TEST 5 PASSED: new_today count correct")
        log(f"   new_today: {new_today} (includes User A and User B)")
        log(f"   total_users: {current_total_users}")
        
        if initial_total_users is not None:
            users_added = current_total_users - initial_total_users
            log(f"   Users added during test: {users_added}")
        
        # TEST 6: Regression tests
        log("\n" + "=" * 80)
        log("TEST 6: Regression - verify existing endpoints still work")
        log("=" * 80)
        
        # As A, GET /api/community/users
        resp = session_a.get(f"{BASE_URL}/community/users")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/community/users failed: {resp.status_code}")
            return False
        log(f"   ✅ GET /api/community/users working")
        
        # GET /api/public/{A's public_id} without auth
        resp = unauth_session.get(f"{BASE_URL}/public/{user_a_public_id}")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/public/{user_a_public_id} failed: {resp.status_code}")
            return False
        
        # Verify sensitive fields NOT exposed
        public_data = resp.json()
        moto = public_data.get('moto', {})
        
        if 'plate' in moto or 'owner_id' in moto or 'is_demo' in moto:
            log(f"❌ FAILED: Public profile exposes sensitive fields")
            return False
        
        log(f"   ✅ GET /api/public/{user_a_public_id} working (no auth, no sensitive fields)")
        
        # As A, GET /api/messages
        resp = session_a.get(f"{BASE_URL}/messages")
        if resp.status_code != 200:
            log(f"❌ FAILED: GET /api/messages failed: {resp.status_code}")
            return False
        log(f"   ✅ GET /api/messages working")
        
        log(f"✅ TEST 6 PASSED: All regression tests successful")
        
        log("\n" + "=" * 80)
        log("🎉 ALL ADMIN DASHBOARD TESTS PASSED!")
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
        
        if user_a_email or user_b_email:
            try:
                # Use the cleanup script approach
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
  
  // Find user IDs
  const users = await db.collection('users').find({{ email: {{ $in: emails }} }}).toArray();
  const userIds = users.map(u => u.id);
  
  if (userIds.length === 0) {{
    console.log('No test users found to delete');
    await c.close();
    return;
  }}
  
  console.log(`Deleting ${{userIds.length}} test users: ${{emails.join(', ')}}`);
  
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
    log("Starting MotoDNA Backend Tests - Admin Dashboard Feature")
    log(f"Base URL: {BASE_URL}")
    log("")
    
    result = test_admin_dashboard()
    
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
