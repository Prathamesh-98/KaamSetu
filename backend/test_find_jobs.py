import asyncio
import httpx
import uuid

async def test():
    async with httpx.AsyncClient(timeout=30) as c:
        # Create an employer
        em = f'emp_{uuid.uuid4().hex[:5]}@t.com'
        r = await c.post('http://localhost:8000/api/auth/register', json={'email': em, 'password': 'Password123!', 'role': 'EMPLOYER'})
        assert r.status_code == 201, f"Register failed: {r.text}"
        tok = r.json()['access_token']
        h = {'Authorization': f'Bearer {tok}'}
        rp = await c.post('http://localhost:8000/api/employers/profile', headers=h, json={'full_name': 'Test Employer'})
        assert rp.status_code == 201, f"Profile failed: {rp.text}"

        # Get categories and skills
        cats = (await c.get('http://localhost:8000/api/categories')).json()
        skills = (await c.get('http://localhost:8000/api/skills', headers=h)).json()
        
        c1 = cats[0]['id']
        c2 = cats[1]['id']
        s1 = skills[0]['id']
        
        print("Seeding jobs...")
        # Create a few jobs
        jobs_data = [
            {'title': 'Plumber Needed', 'category_id': c1, 'description': 'Fix pipes fast', 'work_type': 'HOURLY', 'city': 'Delhi', 'state': 'Delhi', 'salary_type': 'DAILY', 'salary_min': 500, 'salary_max': 1000, 'is_urgent': True, 'required_skill_ids': [s1], 'experience_required': 2},
            {'title': 'Electrician', 'category_id': c2, 'description': 'Wiring work', 'work_type': 'FULL_TIME', 'city': 'Mumbai', 'state': 'Maharashtra', 'salary_type': 'MONTHLY', 'salary_min': 15000, 'salary_max': 25000, 'is_urgent': False, 'required_skill_ids': [], 'experience_required': 5},
            {'title': 'Apprentice Plumber', 'category_id': c1, 'description': 'Learn plumbing', 'work_type': 'HOURLY', 'city': 'Delhi', 'state': 'Delhi', 'salary_type': 'DAILY', 'salary_min': 300, 'salary_max': 600, 'is_urgent': False, 'required_skill_ids': [s1], 'experience_required': 0},
        ]
        
        for jd in jobs_data:
            rj = await c.post('http://localhost:8000/api/jobs', headers=h, json=jd)
            assert rj.status_code == 201, f"Create job failed: {rj.text}"
            
        print("Jobs seeded. Testing search and filters...")
        
        # 1. Base test: GET /jobs should return paginated response
        r = await c.get('http://localhost:8000/api/jobs', headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'items' in data and 'total' in data
        assert data['total'] >= 3
        print("[1] Pagination Wrapper: PASS")
        
        # 2. Search Keyword
        r = await c.get('http://localhost:8000/api/jobs?keyword=Plumber', headers=h)
        data = r.json()
        assert all('plumb' in j['title'].lower() or 'plumb' in j['description'].lower() for j in data['items'])
        print(f"[2] Keyword Search: PASS (found {data['total']} plumber jobs)")
        
        # 3. Category & Location Filter
        r = await c.get(f'http://localhost:8000/api/jobs?category_id={c1}&city=Delhi', headers=h)
        data = r.json()
        assert all(j['category']['id'] == c1 and j['city'] == 'Delhi' for j in data['items'])
        print(f"[3] Category+Location: PASS (found {data['total']} jobs)")
        
        # 4. Salary Filter (min 800) -> Should match job 1 and 2, but job 3 max is 600 so it should be excluded
        r = await c.get('http://localhost:8000/api/jobs?salary_min=800', headers=h)
        data = r.json()
        assert not any(j['title'] == 'Apprentice Plumber' for j in data['items'])
        print("[4] Salary Min Filter: PASS")
        
        # 5. Experience Filter (max 3 years) -> Should match 1 and 3, not 2 (which needs 5)
        # Note: 'experience_required' is not returned in the basic response by default unless we added it, but we can check titles.
        r = await c.get('http://localhost:8000/api/jobs?experience_max=3', headers=h)
        data = r.json()
        assert not any(j['title'] == 'Electrician' for j in data['items'])
        print("[5] Experience Filter: PASS")
        
        # 6. Skill Filter
        r = await c.get(f'http://localhost:8000/api/jobs?skill_id={s1}', headers=h)
        data = r.json()
        assert all(any(sk['skill']['id'] == s1 for sk in j['required_skills']) for j in data['items'])
        print("[6] Skill Filter: PASS")
        
        # 7. Pagination test (per_page=1)
        r = await c.get('http://localhost:8000/api/jobs?per_page=1', headers=h)
        data = r.json()
        assert len(data['items']) == 1
        assert data['total_pages'] == data['total']
        print("[7] Pagination Limit: PASS")
        
        print("\nAll Search/Filter tests passed successfully!")

asyncio.run(test())
