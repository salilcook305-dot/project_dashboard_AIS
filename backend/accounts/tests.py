import json
from datetime import timedelta
from django.test import TestCase, Client
from django.utils import timezone
from accounts.models import User
from projects.models import Project, ProjectMembership
from config.constants import AvailabilityStatus, calculate_workload_status


class AuthAndPermissionsTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@test.com',
            password='Password123!',
            role=User.Role.ADMIN,
            first_name='Admin',
            last_name='User'
        )
        self.manager_user = User.objects.create_user(
            username='mgr_test',
            email='mgr@test.com',
            password='Password123!',
            role=User.Role.MANAGER,
            first_name='Manager',
            last_name='User'
        )
        self.employee_user = User.objects.create_user(
            username='emp_test',
            email='emp@test.com',
            password='Password123!',
            role=User.Role.EMPLOYEE,
            first_name='Employee',
            last_name='User'
        )

    def test_unauthenticated_api_endpoints_return_401(self):
        """Endpoints under /api/ must reject unauthenticated requests with 401."""
        endpoints = [
            '/api/summary/',
            '/api/users/',
            '/api/projects/',
            '/api/employees/workload/',
            '/api/diary/my/',
            '/api/diary/due/',
            '/api/files/',
        ]
        for url in endpoints:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 401, f"Expected 401 for unauthenticated GET {url}, got {res.status_code}")

    def test_login_success_and_csrf_cookie(self):
        """Login uses Django authenticate, returns CSRF token and user session."""
        # Pre-fetch CSRF token
        csrf_res = self.client.get('/api/auth/csrf/')
        self.assertEqual(csrf_res.status_code, 200)
        csrf_token = csrf_res.json().get('csrfToken')
        self.assertTrue(bool(csrf_token))

        # Perform login with username
        login_res = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'admin_test', 'password': 'Password123!'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(login_res.status_code, 200)
        data = login_res.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['user']['username'], 'admin_test')

        # Check me endpoint is now authenticated
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()['username'], 'admin_test')

    def test_login_with_email(self):
        """Login with email works identically to username."""
        csrf_token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        res = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'mgr@test.com', 'password': 'Password123!'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])

    def test_login_invalid_credentials_returns_401(self):
        csrf_token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        res = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'admin_test', 'password': 'WrongPassword'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(res.status_code, 401)
        self.assertFalse(res.json()['success'])

    def test_employee_cannot_create_or_mutate_projects(self):
        """Employees have view-only access and cannot create or modify projects."""
        self.client.force_login(self.employee_user)
        csrf_token = self.client.get('/api/auth/csrf/').json()['csrfToken']

        # Attempt to create project
        payload = {
            'name': 'Unauthorized Project',
            'status': 'Planning'
        }
        res = self.client.post(
            '/api/projects/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(res.status_code, 403)

    def test_role_spoofing_via_headers_is_ignored(self):
        """Sending X-User-Role or X-Current-Portal headers as an employee MUST be ignored."""
        self.client.force_login(self.employee_user)
        csrf_token = self.client.get('/api/auth/csrf/').json()['csrfToken']

        payload = {'name': 'Hacked Project'}
        res = self.client.post(
            '/api/projects/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token,
            HTTP_X_USER_ROLE='admin',
            HTTP_X_CURRENT_PORTAL='admin'
        )
        self.assertEqual(res.status_code, 403, "Role spoofing via headers must be blocked!")

    def test_admin_and_manager_can_create_project(self):
        """Admin and Manager can successfully create a project."""
        self.client.force_login(self.manager_user)
        csrf_token = self.client.get('/api/auth/csrf/').json()['csrfToken']

        payload = {
            'name': 'Manager Project',
            'status': 'In Progress',
            'priority': 'High'
        }
        res = self.client.post(
            '/api/projects/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.json()['success'])
        self.assertEqual(res.json()['project']['name'], 'Manager Project')


class WorkloadAndAvailabilityTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='dev_rohit',
            email='rohit@test.com',
            password='Password123!',
            role=User.Role.EMPLOYEE,
            first_name='Rohit',
            last_name='Kumar',
            department='Backend Engineering'
        )
        self.client.force_login(self.user)

    def test_workload_thresholds(self):
        """Verify thresholds: 0 -> AVAILABLE; 1-2 -> BUSY; 3-4 -> HEAVY; 5+ -> OVERLOADED."""
        self.assertEqual(calculate_workload_status(0), AvailabilityStatus.AVAILABLE)
        self.assertEqual(calculate_workload_status(1), AvailabilityStatus.BUSY)
        self.assertEqual(calculate_workload_status(2), AvailabilityStatus.BUSY)
        self.assertEqual(calculate_workload_status(3), AvailabilityStatus.HEAVY)
        self.assertEqual(calculate_workload_status(4), AvailabilityStatus.HEAVY)
        self.assertEqual(calculate_workload_status(5), AvailabilityStatus.OVERLOADED)
        self.assertEqual(calculate_workload_status(8), AvailabilityStatus.OVERLOADED)

    def test_workload_excludes_completed_cancelled_onhold(self):
        """Completed, Cancelled, and On Hold projects must NOT count toward active count."""
        today = timezone.localdate()
        p1 = Project.objects.create(name='P1 Active', status='In Progress')
        p2 = Project.objects.create(name='P2 Planning', status='Planning')
        p3 = Project.objects.create(name='P3 Completed', status='Completed')
        p4 = Project.objects.create(name='P4 Cancelled', status='Cancelled')
        p5 = Project.objects.create(name='P5 OnHold', status='On Hold')

        for p in [p1, p2, p3, p4, p5]:
            ProjectMembership.objects.create(project=p, employee=self.user)

        self.assertEqual(self.user.get_active_project_count(), 2)
        self.assertEqual(self.user.get_availability_status(today), AvailabilityStatus.BUSY)

    def test_availability_override_and_expiration(self):
        """Override respected if leave_until in future; expires if leave_until < today."""
        today = timezone.localdate()

        # Active override with no leave_until date
        self.user.availability_override = 'ON_LEAVE'
        self.user.leave_until = None
        self.user.save()
        self.assertEqual(self.user.get_availability_status(today), 'ON_LEAVE')

        # Active override with future date
        self.user.leave_until = today + timedelta(days=5)
        self.user.save()
        self.assertEqual(self.user.get_availability_status(today), 'ON_LEAVE')

        # Expired override
        self.user.leave_until = today - timedelta(days=1)
        self.user.save()
        # Fallback to calculated status (0 active projects -> AVAILABLE)
        self.assertEqual(self.user.get_availability_status(today), AvailabilityStatus.AVAILABLE)

    def test_workload_endpoint_filters_and_sorting(self):
        """Test GET /api/employees/workload/ with filters and sorting."""
        p_act = Project.objects.create(name='P Act', status='In Progress')
        ProjectMembership.objects.create(project=p_act, employee=self.user)

        res = self.client.get('/api/employees/workload/?department=Backend Engineering&status=BUSY')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Rohit Kumar')
        self.assertEqual(data[0]['active_count'], 1)
        self.assertEqual(data[0]['status'], 'BUSY')

    def test_user_can_update_own_availability(self):
        """User can update their own availability_override and leave_until."""
        today = timezone.localdate()
        leave_date = (today + timedelta(days=3)).strftime('%Y-%m-%d')
        res = self.client.patch(
            f'/api/users/{self.user.id}/',
            data=json.dumps({
                'availability_override': 'AWAY',
                'leave_until': leave_date
            }),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.availability_override, 'AWAY')
        self.assertEqual(self.user.leave_until.strftime('%Y-%m-%d'), leave_date)
