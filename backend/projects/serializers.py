from rest_framework import serializers
from .models import Project, ProjectMembership
from accounts.models import User
from documents.serializers import DocumentSerializer


class ProjectManagerSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    initials = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'initials', 'job_title', 'department']

    def get_name(self, obj):
        full = obj.get_full_name()
        if full:
            return full
        return obj.username


class ProjectMembershipSerializer(serializers.ModelSerializer):
    employee_id = serializers.PrimaryKeyRelatedField(source='employee.id', read_only=True)
    username = serializers.CharField(source='employee.username', read_only=True)
    name = serializers.SerializerMethodField()
    initials = serializers.CharField(source='employee.initials', read_only=True)
    job_title = serializers.CharField(source='employee.job_title', read_only=True)
    department = serializers.CharField(source='employee.department', read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ['id', 'employee_id', 'username', 'name', 'initials', 'job_title', 'department', 'role_on_project']

    def get_name(self, obj):
        full = obj.employee.get_full_name()
        if full:
            return full
        return obj.employee.username


class MemberInputSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    role_on_project = serializers.CharField(required=False, default='Contributor')


class ProjectSerializer(serializers.ModelSerializer):
    project_manager = ProjectManagerSerializer(read_only=True)
    project_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='project_manager',
        write_only=True,
        required=False,
        allow_null=True
    )
    team = ProjectMembershipSerializer(source='memberships', many=True, read_only=True)
    members = MemberInputSerializer(many=True, write_only=True, required=False)
    documents = DocumentSerializer(many=True, read_only=True)
    documents_count = serializers.SerializerMethodField()
    roadmaps_count = serializers.SerializerMethodField()
    documentation_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'start_date', 'end_date', 'status',
            'project_manager', 'project_manager_id', 'team', 'members',
            'documents', 'documents_count', 'roadmaps_count', 'documentation_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_documents_count(self, obj):
        return obj.documents.count()

    def get_roadmaps_count(self, obj):
        return obj.documents.filter(doc_type='ROADMAP').count()

    def get_documentation_count(self, obj):
        return obj.documents.filter(doc_type='DOCUMENTATION').count()

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date must be greater than or equal to start date.'})
        return attrs

    def create(self, validated_data):
        members_data = validated_data.pop('members', [])
        project = Project.objects.create(**validated_data)
        seen_ids = set()
        for member_info in members_data:
            emp_id = member_info.get('employee_id')
            role = member_info.get('role_on_project', 'Contributor')
            if emp_id and emp_id not in seen_ids:
                try:
                    emp = User.objects.get(id=emp_id)
                    ProjectMembership.objects.create(project=project, employee=emp, role_on_project=role)
                    seen_ids.add(emp_id)
                except User.DoesNotExist:
                    pass
        return project

    def update(self, instance, validated_data):
        members_data = validated_data.pop('members', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if members_data is not None:
            instance.memberships.all().delete()
            seen_ids = set()
            for member_info in members_data:
                emp_id = member_info.get('employee_id')
                role = member_info.get('role_on_project', 'Contributor')
                if emp_id and emp_id not in seen_ids:
                    try:
                        emp = User.objects.get(id=emp_id)
                        ProjectMembership.objects.create(project=instance, employee=emp, role_on_project=role)
                        seen_ids.add(emp_id)
                    except User.DoesNotExist:
                        pass
        return instance

