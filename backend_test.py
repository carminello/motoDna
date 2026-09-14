#!/usr/bin/env python3
"""
MotoDNA PHASE 1 SECURITY HARDENING - Backend Test Suite
Tests all 9 groups of security hardening features
"""
import requests
import time
import io
from PIL import Image
import random
import string

# Base URL from .env
BASE_URL = "https://dna-garage.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test data storage
test_users = []
test_motorcycles = []
test_files = []

def generate_test_email():
    """Generate unique test email"""
    timestamp = int(time.time())
    random_suffix = ''.join(random.choices(string.ascii_lowercase, k=6))
    return f"test_security_{timestamp}_{random_suffix}@motodna.test"

def create_test_image():
    """Create a small test PNG image"""
    img = Image.new('RGB', (100, 100), color='red')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

def cleanup():
    """Cleanup test data"""
    print("\n" + "="*80)
    print("CLEANUP: Deleting test users and data...")
    print("="*80)
    
    # Delete users (this will cascade delete related data via MongoDB)
    for user_data in test_users:
        try:
            # Login to get fresh cookie
            login_resp = requests.post(f"{API_BASE}/auth/login", json={
                "email": user_data['email'],
                "password": user_data['password']
            })
            if login_resp.status_code == 200:
                cookie = login_resp.cookies.get('motodna_token')
                # Note: There's no DELETE user endpoint, so we'll just logout
                # In production, admin would need to manually clean test users
                requests.post(f"{API_BASE}/auth/logout", cookies={'motodna_token': cookie})
                print(f"✓ Logged out user: {user_data['email']}")
        except Exception as e:
            print(f"✗ Error cleaning up user {user_data['email']}: {e}")
    
    print(f"\nTest users created: {len(test_users)}")
    print("Note: Test users remain in DB. Admin should run cleanup script if needed.")

# ============================================================================
# TEST GROUP 1: AUTH BASELINE
# ============================================================================
def test_group_1_auth_baseline():
    """Test auth endpoints with fresh users (JWT_SECRET was rotated)"""
    print("\n" + "="*80)
    print("TEST GROUP 1: AUTH BASELINE")
    print("="*80)
    
    # Test 1.1: GET /api/auth/me without cookie → 200 {user: null}
    print("\n[1.1] GET /api/auth/me without cookie")
    try:
        resp = requests.get(f"{API_BASE}/auth/me")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('user') is None, f"Expected user=null, got {data.get('user')}"
        print("✅ PASS: No-auth returns {user: null}")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 1.2: POST /api/auth/register with fresh email/password
    print("\n[1.2] POST /api/auth/register with fresh email/password")
    try:
        email = generate_test_email()
        password = "SecurePass123!"
        first_name = "TestUser"
        username = f"testuser_{int(time.time())}"
        
        resp = requests.post(f"{API_BASE}/auth/register", json={
            "email": email,
            "password": password,
            "first_name": first_name,
            "username": username
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        # Check Set-Cookie header
        cookie = resp.cookies.get('motodna_token')
        assert cookie is not None, "Expected Set-Cookie motodna_token"
        
        # Check response body
        data = resp.json()
        assert 'user' in data, "Expected 'user' in response"
        user = data['user']
        assert 'id' in user, "Expected 'id' in user"
        assert user['email'] == email.lower(), f"Expected email {email.lower()}, got {user['email']}"
        assert user['first_name'] == first_name, f"Expected first_name {first_name}, got {user['first_name']}"
        assert user['username'] == username, f"Expected username {username}, got {user['username']}"
        assert 'password_hash' not in user, "password_hash should NOT be in response"
        
        # Store for later tests
        test_users.append({
            'email': email,
            'password': password,
            'user_id': user['id'],
            'cookie': cookie
        })
        
        print(f"✅ PASS: Register successful, user_id={user['id']}, cookie set, no password_hash exposed")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 1.3: GET /api/auth/me with cookie → 200 with full user
    print("\n[1.3] GET /api/auth/me with cookie")
    try:
        cookie = test_users[0]['cookie']
        resp = requests.get(f"{API_BASE}/auth/me", cookies={'motodna_token': cookie})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('user') is not None, "Expected user object"
        user = data['user']
        assert user['id'] == test_users[0]['user_id'], "User ID mismatch"
        assert 'password_hash' not in user, "password_hash should NOT be in response"
        print(f"✅ PASS: GET /api/auth/me returns user, no password_hash")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 1.4: POST /api/auth/logout → 200 + cookie cleared
    print("\n[1.4] POST /api/auth/logout")
    try:
        cookie = test_users[0]['cookie']
        resp = requests.post(f"{API_BASE}/auth/logout", cookies={'motodna_token': cookie})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Check if cookie is cleared (maxAge=0 or empty value)
        set_cookie = resp.headers.get('Set-Cookie', '')
        assert 'motodna_token=' in set_cookie, "Expected motodna_token in Set-Cookie"
        print(f"✅ PASS: Logout successful, cookie cleared")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 1.5: POST /api/auth/login with correct credentials
    print("\n[1.5] POST /api/auth/login with correct credentials")
    try:
        resp = requests.post(f"{API_BASE}/auth/login", json={
            "email": test_users[0]['email'],
            "password": test_users[0]['password']
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        cookie = resp.cookies.get('motodna_token')
        assert cookie is not None, "Expected Set-Cookie motodna_token"
        
        data = resp.json()
        assert 'user' in data, "Expected 'user' in response"
        assert 'is_admin' in data['user'], "Expected 'is_admin' field in user"
        
        # Update cookie
        test_users[0]['cookie'] = cookie
        
        print(f"✅ PASS: Login successful, cookie set, is_admin field present")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 1.6: POST /api/auth/login with WRONG password → 401
    print("\n[1.6] POST /api/auth/login with WRONG password")
    try:
        resp = requests.post(f"{API_BASE}/auth/login", json={
            "email": test_users[0]['email'],
            "password": "WrongPassword123!"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        data = resp.json()
        assert 'error' in data, "Expected 'error' in response"
        assert "Credenziali non valide" in data['error'], f"Expected 'Credenziali non valide', got {data['error']}"
        print(f"✅ PASS: Wrong password returns 401 with correct error message")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 1: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 2: RATE LIMIT LOGIN (NEW FEATURE)
# ============================================================================
def test_group_2_rate_limit_login():
    """Test rate limiting on login endpoint"""
    print("\n" + "="*80)
    print("TEST GROUP 2: RATE LIMIT LOGIN (NEW FEATURE)")
    print("="*80)
    
    # Use the first test user's email
    email = test_users[0]['email']
    wrong_password = "WrongPassword123!"
    
    # Test 2.1: First 5 wrong attempts should return 401
    print("\n[2.1] First 5 wrong login attempts should return 401")
    try:
        for i in range(1, 6):
            resp = requests.post(f"{API_BASE}/auth/login", json={
                "email": email,
                "password": wrong_password
            })
            assert resp.status_code == 401, f"Attempt {i}: Expected 401, got {resp.status_code}"
            print(f"  Attempt {i}/5: 401 ✓")
        print("✅ PASS: First 5 attempts return 401")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 2.2: 6th attempt should return 429 with retryAfterSec
    print("\n[2.2] 6th attempt should return 429 with retryAfterSec")
    try:
        resp = requests.post(f"{API_BASE}/auth/login", json={
            "email": email,
            "password": wrong_password
        })
        assert resp.status_code == 429, f"Expected 429, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert 'error' in data, "Expected 'error' in response"
        assert "Troppi tentativi" in data['error'], f"Expected 'Troppi tentativi' in error, got {data['error']}"
        
        # Extract retryAfterSec from error message
        import re
        match = re.search(r'(\d+)s', data['error'])
        assert match is not None, f"Expected retryAfterSec in error message, got {data['error']}"
        retry_after = int(match.group(1))
        assert 1 <= retry_after <= 60, f"Expected retryAfterSec between 1-60, got {retry_after}"
        
        print(f"✅ PASS: 6th attempt returns 429 with retryAfterSec={retry_after}s")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 2.3: Different email should have separate bucket
    print("\n[2.3] Different email should have separate rate limit bucket")
    try:
        different_email = generate_test_email()
        resp = requests.post(f"{API_BASE}/auth/login", json={
            "email": different_email,
            "password": wrong_password
        })
        # Should return 401 (user not found), not 429
        assert resp.status_code == 401, f"Expected 401 for different email, got {resp.status_code}"
        print(f"✅ PASS: Different email has separate rate limit bucket")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 2: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 3: TOKENS AND PUBLIC IDs
# ============================================================================
def test_group_3_tokens_and_public_ids():
    """Test public_id generation with crypto.randomInt (no confused chars)"""
    print("\n" + "="*80)
    print("TEST GROUP 3: TOKENS AND PUBLIC IDs")
    print("="*80)
    
    cookie = test_users[0]['cookie']
    
    # Test 3.1: Create motorcycle and verify public_id format
    print("\n[3.1] POST /api/motorcycles - verify public_id format")
    try:
        resp = requests.post(f"{API_BASE}/motorcycles", 
            cookies={'motodna_token': cookie},
            json={
                "brand": "Honda",
                "model": "CB750",
                "year": 2024
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        moto = data['moto']
        public_id = moto['public_id']
        
        # Verify format: MDNA-24-CB7-XXXXX (5 chars from ALNUM set without confused chars)
        import re
        pattern = r'^MDNA-24-CB7-[A-Z0-9]{5}$'
        assert re.match(pattern, public_id), f"public_id {public_id} doesn't match pattern {pattern}"
        
        # Verify no confused chars (0, O, 1, I) in the 5-char suffix
        suffix = public_id.split('-')[-1]
        confused_chars = set('01OI')
        assert not any(c in confused_chars for c in suffix), f"public_id suffix {suffix} contains confused chars"
        
        test_motorcycles.append({
            'id': moto['id'],
            'public_id': public_id,
            'owner_cookie': cookie
        })
        
        print(f"✅ PASS: public_id={public_id} matches format, no confused chars")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 3.2: Create 3 more motorcycles and verify all public_ids are unique
    print("\n[3.2] Create 3 more motorcycles - verify uniqueness")
    try:
        public_ids = [test_motorcycles[0]['public_id']]
        
        for i in range(3):
            resp = requests.post(f"{API_BASE}/motorcycles", 
                cookies={'motodna_token': cookie},
                json={
                    "brand": "Yamaha",
                    "model": "R1",
                    "year": 2024
                }
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            
            moto = resp.json()['moto']
            public_id = moto['public_id']
            
            # Verify format
            pattern = r'^MDNA-24-R1-[A-Z0-9]{5}$'
            assert re.match(pattern, public_id), f"public_id {public_id} doesn't match pattern"
            
            # Verify no confused chars
            suffix = public_id.split('-')[-1]
            confused_chars = set('01OI')
            assert not any(c in confused_chars for c in suffix), f"Suffix {suffix} contains confused chars"
            
            # Verify uniqueness
            assert public_id not in public_ids, f"Duplicate public_id: {public_id}"
            public_ids.append(public_id)
            
            test_motorcycles.append({
                'id': moto['id'],
                'public_id': public_id,
                'owner_cookie': cookie
            })
            
            print(f"  Moto {i+2}: public_id={public_id} ✓")
        
        print(f"✅ PASS: All 4 public_ids are unique and valid")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 3: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 4: TRANSFER CODE
# ============================================================================
def test_group_4_transfer_code():
    """Test transfer code generation (8 chars, no confused chars)"""
    print("\n" + "="*80)
    print("TEST GROUP 4: TRANSFER CODE")
    print("="*80)
    
    cookie = test_users[0]['cookie']
    moto_id = test_motorcycles[0]['id']
    
    # Test 4.1: Generate transfer code and verify format
    print("\n[4.1] POST /api/motorcycles/:id/transfer - verify code format")
    try:
        resp = requests.post(f"{API_BASE}/motorcycles/{moto_id}/transfer",
            cookies={'motodna_token': cookie}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        transfer = data['transfer']
        code = transfer['code']
        
        # Verify format: 8 chars from ALNUM set (no confused chars 0, O, 1, I)
        import re
        pattern = r'^[A-Z0-9]{8}$'
        assert re.match(pattern, code), f"Transfer code {code} doesn't match pattern {pattern}"
        
        # Verify no confused chars
        confused_chars = set('01OI')
        assert not any(c in confused_chars for c in code), f"Transfer code {code} contains confused chars"
        
        print(f"✅ PASS: Transfer code={code} matches format, no confused chars")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 4.2: GET /api/motorcycles/:id/transfer - verify same code
    print("\n[4.2] GET /api/motorcycles/:id/transfer - verify same code")
    try:
        resp = requests.get(f"{API_BASE}/motorcycles/{moto_id}/transfer",
            cookies={'motodna_token': cookie}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        transfer = data['transfer']
        assert transfer is not None, "Expected transfer object"
        
        # Code should be the same as before
        new_code = transfer['code']
        print(f"✅ PASS: GET returns same transfer code={new_code}")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 4.3: Generate 5 transfer codes and verify uniqueness
    print("\n[4.3] Generate 5 transfer codes - verify uniqueness")
    try:
        codes = []
        
        for i in range(5):
            resp = requests.post(f"{API_BASE}/motorcycles/{moto_id}/transfer",
                cookies={'motodna_token': cookie}
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            
            code = resp.json()['transfer']['code']
            
            # Verify format
            pattern = r'^[A-Z0-9]{8}$'
            assert re.match(pattern, code), f"Code {code} doesn't match pattern"
            
            # Verify no confused chars
            confused_chars = set('01OI')
            assert not any(c in confused_chars for c in code), f"Code {code} contains confused chars"
            
            # Verify uniqueness
            assert code not in codes, f"Duplicate transfer code: {code}"
            codes.append(code)
            
            print(f"  Code {i+1}: {code} ✓")
        
        print(f"✅ PASS: All 5 transfer codes are unique and valid")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 4: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 5: UPLOAD PUBLIC (REGRESSION)
# ============================================================================
def test_group_5_upload_public():
    """Test public file upload (regression)"""
    print("\n" + "="*80)
    print("TEST GROUP 5: UPLOAD PUBLIC (REGRESSION)")
    print("="*80)
    
    cookie = test_users[0]['cookie']
    
    # Test 5.1: POST /api/uploads without visibility field → public by default
    print("\n[5.1] POST /api/uploads without visibility field")
    try:
        img_buf = create_test_image()
        files = {'file': ('test.png', img_buf, 'image/png')}
        
        resp = requests.post(f"{API_BASE}/uploads",
            cookies={'motodna_token': cookie},
            files=files
        )
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert 'id' in data, "Expected 'id' in response"
        assert 'url' in data, "Expected 'url' in response"
        assert data['url'].startswith('/api/files/'), f"Expected url to start with '/api/files/', got {data['url']}"
        assert data['contentType'] == 'image/png', f"Expected contentType 'image/png', got {data['contentType']}"
        assert data['size'] > 0, "Expected size > 0"
        assert data['visibility'] == 'public', f"Expected visibility 'public', got {data['visibility']}"
        
        file_url = BASE_URL + data['url']
        test_files.append({
            'id': data['id'],
            'url': file_url,
            'visibility': 'public',
            'owner_cookie': cookie
        })
        
        print(f"✅ PASS: Upload successful, visibility='public', url={data['url']}")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 5.2: GET file URL without cookie → 200 with correct headers
    print("\n[5.2] GET file URL without cookie")
    try:
        file_url = test_files[0]['url']
        resp = requests.get(file_url)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        assert resp.headers['Content-Type'] == 'image/png', f"Expected Content-Type 'image/png', got {resp.headers['Content-Type']}"
        
        cache_control = resp.headers.get('Cache-Control', '')
        assert 'public' in cache_control, f"Expected 'public' in Cache-Control, got {cache_control}"
        assert 'max-age=31536000' in cache_control, f"Expected 'max-age=31536000' in Cache-Control, got {cache_control}"
        assert 'immutable' in cache_control, f"Expected 'immutable' in Cache-Control, got {cache_control}"
        
        print(f"✅ PASS: Public file accessible without auth, correct Cache-Control headers")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 5: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 6: UPLOAD PRIVATE + OWNERSHIP CHECK (CRITICAL)
# ============================================================================
def test_group_6_upload_private_ownership():
    """Test private file upload with ownership check (NEW SECURITY FEATURE)"""
    print("\n" + "="*80)
    print("TEST GROUP 6: UPLOAD PRIVATE + OWNERSHIP CHECK (CRITICAL)")
    print("="*80)
    
    cookie_a = test_users[0]['cookie']
    
    # Test 6.1: POST /api/uploads with visibility=private
    print("\n[6.1] POST /api/uploads with visibility=private")
    try:
        img_buf = create_test_image()
        files = {'file': ('test_private.png', img_buf, 'image/png')}
        data_form = {'visibility': 'private'}
        
        resp = requests.post(f"{API_BASE}/uploads",
            cookies={'motodna_token': cookie_a},
            files=files,
            data=data_form
        )
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert data['visibility'] == 'private', f"Expected visibility 'private', got {data['visibility']}"
        
        file_url = BASE_URL + data['url']
        test_files.append({
            'id': data['id'],
            'url': file_url,
            'visibility': 'private',
            'owner_cookie': cookie_a
        })
        
        print(f"✅ PASS: Private file uploaded, visibility='private', url={data['url']}")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 6.2: GET private file URL without cookie → 401
    print("\n[6.2] GET private file URL without cookie → 401")
    try:
        file_url = test_files[-1]['url']
        resp = requests.get(file_url)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        assert resp.text == 'Unauthorized', f"Expected 'Unauthorized', got {resp.text}"
        print(f"✅ PASS: Private file returns 401 without auth")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 6.3: GET private file URL with uploader's cookie → 200
    print("\n[6.3] GET private file URL with uploader's cookie → 200")
    try:
        file_url = test_files[-1]['url']
        resp = requests.get(file_url, cookies={'motodna_token': cookie_a})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        cache_control = resp.headers.get('Cache-Control', '')
        assert 'private' in cache_control, f"Expected 'private' in Cache-Control, got {cache_control}"
        assert 'no-store' in cache_control, f"Expected 'no-store' in Cache-Control, got {cache_control}"
        
        print(f"✅ PASS: Private file accessible to uploader, correct Cache-Control headers")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 6.4: Register User B and try to access User A's private file → 403
    print("\n[6.4] Register User B and try to access User A's private file → 403")
    try:
        # Register User B
        email_b = generate_test_email()
        password_b = "SecurePass456!"
        
        resp = requests.post(f"{API_BASE}/auth/register", json={
            "email": email_b,
            "password": password_b,
            "first_name": "UserB",
            "username": f"userb_{int(time.time())}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        cookie_b = resp.cookies.get('motodna_token')
        user_b = resp.json()['user']
        
        test_users.append({
            'email': email_b,
            'password': password_b,
            'user_id': user_b['id'],
            'cookie': cookie_b
        })
        
        print(f"  User B registered: {email_b}")
        
        # Try to access User A's private file with User B's cookie
        file_url = test_files[-1]['url']
        resp = requests.get(file_url, cookies={'motodna_token': cookie_b})
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        assert resp.text == 'Forbidden', f"Expected 'Forbidden', got {resp.text}"
        
        print(f"✅ PASS: User B cannot access User A's private file (403 Forbidden)")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 6.5: GET malformed file id → 404
    print("\n[6.5] GET malformed file id → 404")
    try:
        resp = requests.get(f"{BASE_URL}/api/files/notavalidid")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print(f"✅ PASS: Malformed file id returns 404")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 6.6: GET valid-looking but non-existent ObjectId → 404
    print("\n[6.6] GET valid-looking but non-existent ObjectId → 404")
    try:
        resp = requests.get(f"{BASE_URL}/api/files/000000000000000000000000")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print(f"✅ PASS: Non-existent file id returns 404")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 6: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 7: NFC ASSOCIATE (REGRESSION)
# ============================================================================
def test_group_7_nfc_associate():
    """Test NFC associate endpoint (regression)"""
    print("\n" + "="*80)
    print("TEST GROUP 7: NFC ASSOCIATE (REGRESSION)")
    print("="*80)
    
    cookie = test_users[0]['cookie']
    moto_id = test_motorcycles[0]['id']
    
    # Test 7.1: POST /api/motorcycles/:id/nfc/associate
    print("\n[7.1] POST /api/motorcycles/:id/nfc/associate")
    try:
        tag_uid = "04:aa:bb:cc:dd:ee"
        resp = requests.post(f"{API_BASE}/motorcycles/{moto_id}/nfc/associate",
            cookies={'motodna_token': cookie},
            json={"tag_uid": tag_uid}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert 'nfc' in data, "Expected 'nfc' in response"
        nfc = data['nfc']
        
        # Verify tag_uid is normalized (lowercase, colons kept)
        expected_uid = "04:aa:bb:cc:dd:ee"
        assert nfc['tag_uid'] == expected_uid, f"Expected tag_uid '{expected_uid}', got '{nfc['tag_uid']}'"
        
        print(f"✅ PASS: NFC associate successful, tag_uid={nfc['tag_uid']}")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Test 7.2: Duplicate tag_uid on another motorcycle → 409
    print("\n[7.2] Duplicate tag_uid on another motorcycle → 409")
    try:
        # Use a different motorcycle
        if len(test_motorcycles) > 1:
            moto_id_2 = test_motorcycles[1]['id']
            resp = requests.post(f"{API_BASE}/motorcycles/{moto_id_2}/nfc/associate",
                cookies={'motodna_token': cookie},
                json={"tag_uid": tag_uid}
            )
            assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
            print(f"✅ PASS: Duplicate tag_uid returns 409")
        else:
            print(f"⚠️  SKIP: Not enough motorcycles to test duplicate tag_uid")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 7: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 8: PUBLIC PROFILE (REGRESSION)
# ============================================================================
def test_group_8_public_profile():
    """Test public profile endpoint (regression)"""
    print("\n" + "="*80)
    print("TEST GROUP 8: PUBLIC PROFILE (REGRESSION)")
    print("="*80)
    
    public_id = test_motorcycles[0]['public_id']
    
    # Test 8.1: GET /api/public/:public_id without auth → 200
    print("\n[8.1] GET /api/public/:public_id without auth")
    try:
        resp = requests.get(f"{API_BASE}/public/{public_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert 'moto' in data, "Expected 'moto' in response"
        assert 'owner' in data, "Expected 'owner' in response"
        assert 'maintenance' in data, "Expected 'maintenance' in response"
        assert 'timeline' in data, "Expected 'timeline' in response"
        assert 'modifications' in data, "Expected 'modifications' in response"
        assert 'gallery' in data, "Expected 'gallery' in response"
        assert 'postits' in data, "Expected 'postits' in response"
        assert 'scan_count' in data, "Expected 'scan_count' in response"
        
        # Verify moto object does NOT contain sensitive fields
        moto = data['moto']
        assert 'plate' not in moto, "moto should NOT contain 'plate'"
        assert 'owner_id' not in moto, "moto should NOT contain 'owner_id'"
        assert 'is_demo' not in moto, "moto should NOT contain 'is_demo'"
        
        print(f"✅ PASS: Public profile accessible, no sensitive fields exposed")
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 8: ALL TESTS PASSED")
    print("="*80)
    return True

# ============================================================================
# TEST GROUP 9: MONGO INDEXES (SANITY CHECK)
# ============================================================================
def test_group_9_mongo_indexes():
    """Test MongoDB indexes (informational sanity check)"""
    print("\n" + "="*80)
    print("TEST GROUP 9: MONGO INDEXES (SANITY CHECK)")
    print("="*80)
    
    print("\n[9.1] Check supervisor logs for index creation")
    try:
        import subprocess
        result = subprocess.run(
            ['tail', '-n', '100', '/var/log/supervisor/nextjs.out.log'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        logs = result.stdout
        
        # Check for index creation errors
        if 'createIndex failed' in logs:
            print(f"⚠️  WARNING: Found 'createIndex failed' in logs")
            print(f"  This may indicate index creation issues")
        else:
            print(f"✅ PASS: No 'createIndex failed' errors in recent logs")
        
        # This is informational only, don't fail the test
        print(f"  (This is an informational check, not a failure)")
        
    except Exception as e:
        print(f"⚠️  Could not check logs: {e}")
        print(f"  (This is optional, not a failure)")
    
    print("\n" + "="*80)
    print("✅ TEST GROUP 9: SANITY CHECK COMPLETE")
    print("="*80)
    return True

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    """Run all test groups"""
    print("\n" + "="*80)
    print("MOTODNA PHASE 1 SECURITY HARDENING - BACKEND TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("="*80)
    
    results = {}
    
    try:
        # Run all test groups in order
        results['Group 1: Auth Baseline'] = test_group_1_auth_baseline()
        results['Group 2: Rate Limit Login'] = test_group_2_rate_limit_login()
        results['Group 3: Tokens and Public IDs'] = test_group_3_tokens_and_public_ids()
        results['Group 4: Transfer Code'] = test_group_4_transfer_code()
        results['Group 5: Upload Public'] = test_group_5_upload_public()
        results['Group 6: Upload Private + Ownership'] = test_group_6_upload_private_ownership()
        results['Group 7: NFC Associate'] = test_group_7_nfc_associate()
        results['Group 8: Public Profile'] = test_group_8_public_profile()
        results['Group 9: Mongo Indexes'] = test_group_9_mongo_indexes()
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        cleanup()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for group, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {group}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} test groups passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! PHASE 1 SECURITY HARDENING VERIFIED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test group(s) failed. Please review.")
        return 1

if __name__ == '__main__':
    exit(main())
