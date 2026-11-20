import json
from datetime import timedelta
from django.test import TestCase, Client
from django.utils import timezone
from accounts.models import User
from projects.models import Project, ProjectMembership, DiaryEntry, ActivityLog


class DiaryAndPocTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='admin_usr',
            email='admin@aisamrat.com',
            password='Password123!',
            role=User.Role.ADMIN,
            first_name='Admin',
            last_name='Samrat'
        )
        self.manager = User.objects.create_user(
            username='mgr_deepak',
            email='deepak@aisamrat.com',
            password='Password123!',
            role=User.Role.MANAGER,
            first_name='Deepak',
            last_name='S J'
        )
        self.employee1 = User.objects.create_user(
            username='emp_kavita',
            email='kavita@aisamrat.com',
            password='Password123!',
            role=User.Role.EMPLOYEE,
            first_name='Kavita',
            last_name='R'
        )
        self.employee2 = User.objects.create_user(
            username='emp_rahul',
            email='rahul@aisamrat.com',
            password='Password123!',
            role=User.Role.EMPLOYEE,
            first_name='Rahul',
            last_name='Verma'
        )
        self.external_emp = User.objects.create_user(
            username='emp_external',
            email='external@aisamrat.com',
            password='Password123!',
            role=User.Role.EMPLOYEE,
            first_name='External',
            last_name='User'
        )

        self.project = Project.objects.create(
            name='Alpha Platform',
            project_code='AIS-ALP-01',
            status='In Progress',
            project_manager=self.manager
        )
        ProjectMembership.objects.create(project=self.project, employee=self.manager, role_on_project='Project Manager')
        ProjectMembership.objects.create(project=self.project, employee=self.employee1, role_on_project='Lead Developer')
        ProjectMembership.objects.create(project=self.project, employee=self.employee2, role_on_project='Frontend Engineer')

    def test_poc_validation_and_assignment(self):
        """POC must be an assigned member of the project."""
        self.client.force_login(self.manager)

        # Attempt to set POC who is NOT a member
        res_invalid = self.client.patch(
            f'/api/projects/{self.project.id}/',
            data=json.dumps({'poc_id': self.external_emp.id}),
            content_type='application/json'
        )
        self.assertEqual(res_invalid.status_code, 400)
        self.assertIn('must be an assigned member', res_invalid.json().get('error', ''))

        # Set valid member as POC
        res_valid = self.client.patch(
            f'/api/projects/{self.project.id}/',
            data=json.dumps({'poc_id': self.employee1.id}),
            content_type='application/json'
        )
        self.assertEqual(res_valid.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.poc_id, self.employee1.id)

        # Project detail returns POC info
        get_res = self.client.get(f'/api/projects/{self.project.id}/')
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()['poc']['id'], self.employee1.id)

    def test_diary_read_permissions(self):
        """Only project members, POC, PM, or Admin/Manager can view the diary."""
        # Non-member employee
        self.client.force_login(self.external_emp)
        res_ext = self.client.get(f'/api/projects/{self.project.id}/diary/')
        self.assertEqual(res_ext.status_code, 403)

        # Assigned member
        self.client.force_login(self.employee1)
        res_mem = self.client.get(f'/api/projects/{self.project.id}/diary/')
        self.assertEqual(res_mem.status_code, 200)

        # Admin
        self.client.force_login(self.admin)
        res_admin = self.client.get(f'/api/projects/{self.project.id}/diary/')
        self.assertEqual(res_admin.status_code, 200)

    def test_diary_entry_creation_and_update(self):
        """Only Point of Contact can update the works diary; other employees in group can only view."""
        self.project.poc = self.employee1
        self.project.save()

        today = timezone.localdate()

        payload = {
            'done': 'Completed API endpoints for authentication',
            'in_progress': 'Writing unit tests and permission checks',
            'next_up': 'React frontend integration',
            'blockers': 'None'
        }

        # Regular member in project group (not POC) cannot update diary -> 403
        self.client.force_login(self.employee2)
        res_non_poc = self.client.post(
            f'/api/projects/{self.project.id}/diary/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res_non_poc.status_code, 403)
        self.assertIn('Only the Point of Contact', res_non_poc.json().get('error', ''))

        # Point of Contact creates today's entry
        self.client.force_login(self.employee1)
        res = self.client.post(
            f'/api/projects/{self.project.id}/diary/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['entry']['author']['id'], self.employee1.id)
        self.assertEqual(data['entry']['done'], payload['done'])

        # Verify entry in DB
        entry = DiaryEntry.objects.get(project=self.project, author=self.employee1, entry_date=today)
        self.assertEqual(entry.in_progress, payload['in_progress'])

        # ActivityLog created
        self.assertTrue(ActivityLog.objects.filter(project=self.project, action='Diary Saved').exists())

        # Second POST updates today's entry (upsert)
        payload['done'] = 'Updated done text for today'
        res2 = self.client.post(
            f'/api/projects/{self.project.id}/diary/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res2.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.done, 'Updated done text for today')

    def test_diary_edit_permissions_and_date_restriction(self):
        """POC can edit entry on its own date; past date blocked for POC but allowed for admin."""
        self.project.poc = self.employee1
        self.project.save()
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        past_entry = DiaryEntry.objects.create(
            project=self.project,
            author=self.employee1,
            entry_date=yesterday,
            done='Old done',
            in_progress='Old prog',
            next_up='Old next'
        )

        # Other employee cannot edit
        self.client.force_login(self.employee2)
        res_other = self.client.patch(
            f'/api/diary/{past_entry.id}/',
            data=json.dumps({'done': 'Tampered done'}),
            content_type='application/json'
        )
        self.assertEqual(res_other.status_code, 403)

        # Author cannot edit past entry
        self.client.force_login(self.employee1)
        res_author_past = self.client.patch(
            f'/api/diary/{past_entry.id}/',
            data=json.dumps({'done': 'New done'}),
            content_type='application/json'
        )
        self.assertEqual(res_author_past.status_code, 403)

        # Admin CAN edit past entry
        self.client.force_login(self.admin)
        res_admin = self.client.patch(
            f'/api/diary/{past_entry.id}/',
            data=json.dumps({'done': 'Admin corrected done'}),
            content_type='application/json'
        )
        self.assertEqual(res_admin.status_code, 200)
        past_entry.refresh_from_db()
        self.assertEqual(past_entry.done, 'Admin corrected done')

    def test_diary_review_endpoint(self):
        """POC, PM, Admin/Manager can review; regular member cannot."""
        today = timezone.localdate()
        self.project.poc = self.employee2
        self.project.save()

        entry = DiaryEntry.objects.create(
            project=self.project,
            author=self.employee1,
            entry_date=today,
            done='Done',
            in_progress='In prog',
            next_up='Next'
        )

        # External employee cannot review
        self.client.force_login(self.external_emp)
        res_unauth = self.client.post(f'/api/diary/{entry.id}/review/')
        self.assertEqual(res_unauth.status_code, 403)

        # POC can review
        self.client.force_login(self.employee2)
        res_poc = self.client.post(f'/api/diary/{entry.id}/review/')
        self.assertEqual(res_poc.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.reviewed_by_id, self.employee2.id)
        self.assertIsNotNone(entry.reviewed_at)

    def test_my_diary_and_prefill(self):
        """GET /api/diary/my/ returns user's active projects with prefill from previous next_up."""
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        # Create yesterday's entry with next_up = 'Build UI components'
        DiaryEntry.objects.create(
            project=self.project,
            author=self.employee1,
            entry_date=yesterday,
            done='Past done',
            in_progress='Past in prog',
            next_up='Build UI components'
        )

        self.client.force_login(self.employee1)
        res = self.client.get('/api/diary/my/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(len(data) >= 1)
        item = next(x for x in data if x['project']['id'] == self.project.id)
        self.assertIsNone(item['today_entry'])
        self.assertEqual(item['prefill']['in_progress'], 'Build UI components')

    def test_diary_due_and_project_overdue_flag(self):
        """GET /api/diary/due/ flags members with no update; project diary_overdue is True after 2+ days."""
        today = timezone.localdate()
        two_days_ago = today - timedelta(days=2)

        # Last diary entry was 2 days ago
        DiaryEntry.objects.create(
            project=self.project,
            author=self.employee1,
            entry_date=two_days_ago,
            done='Old done',
            in_progress='Old in prog',
            next_up='Old next'
        )

        # Check project list has diary_overdue = True
        self.client.force_login(self.manager)
        proj_res = self.client.get('/api/projects/')
        self.assertEqual(proj_res.status_code, 200)
        target = next(p for p in proj_res.json() if p['id'] == self.project.id)
        self.assertTrue(target['diary_overdue'])
        self.assertEqual(target['last_diary_date'], two_days_ago.strftime('%Y-%m-%d'))

        # Check due endpoint returns missing members for today
        due_res = self.client.get('/api/diary/due/')
        self.assertEqual(due_res.status_code, 200)
        due_data = due_res.json()
        self.assertTrue(due_data['total_missing'] > 0)
