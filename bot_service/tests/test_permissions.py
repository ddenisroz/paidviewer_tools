"""
Test permission and role system
Tests RBAC, role hierarchy, and permission checks
"""
import sys
from pathlib import Path
from unittest.mock import Mock

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestPermissionSystem:
    """Test suite for permission system"""
    
    def test_app_roles_defined(self):
        """Test that all application roles are defined"""
        from core.permissions import AppRole
        
        assert hasattr(AppRole, 'ADMIN')
        assert hasattr(AppRole, 'USER')
        assert hasattr(AppRole, 'GUEST')
        
        assert AppRole.ADMIN.value == 'admin'
        assert AppRole.USER.value == 'user'
        assert AppRole.GUEST.value == 'guest'
        
        print("[OK] Application roles are defined correctly")
    
    def test_permissions_defined(self):
        """Test that all permissions are defined"""
        from core.permissions import Permission
        
        # Admin permissions
        assert hasattr(Permission, 'MANAGE_USERS')
        assert hasattr(Permission, 'MANAGE_GLOBAL_VOICES')
        assert hasattr(Permission, 'VIEW_ALL_SETTINGS')
        assert hasattr(Permission, 'MANAGE_SYSTEM')
        assert hasattr(Permission, 'BLOCK_USERS')
        
        # User permissions
        assert hasattr(Permission, 'MANAGE_OWN_SETTINGS')
        assert hasattr(Permission, 'MANAGE_OWN_VOICES')
        assert hasattr(Permission, 'MANAGE_STREAM')
        assert hasattr(Permission, 'MANAGE_BOTS')
        assert hasattr(Permission, 'MANAGE_COMMANDS')
        assert hasattr(Permission, 'MANAGE_REWARDS')
        assert hasattr(Permission, 'MANAGE_DROPS')
        
        # Guest permissions
        assert hasattr(Permission, 'VIEW_CHAT')
        assert hasattr(Permission, 'VIEW_PUBLIC_DATA')
        
        print("[OK] All permissions are defined")
    
    def test_platform_roles_defined(self):
        """Test that platform roles are defined"""
        from core.permissions import PlatformRole
        
        assert hasattr(PlatformRole, 'BROADCASTER')
        assert hasattr(PlatformRole, 'MODERATOR')
        assert hasattr(PlatformRole, 'VIP')
        assert hasattr(PlatformRole, 'SUBSCRIBER')
        assert hasattr(PlatformRole, 'VIEWER')
        assert hasattr(PlatformRole, 'OWNER')
        
        print("[OK] Platform roles are defined correctly")
    
    def test_admin_has_all_permissions(self):
        """Test that admin role has all permissions"""
        from core.permissions import AppRole, Permission, has_permission
        
        # Admin should have all permissions
        for permission in Permission:
            assert has_permission(AppRole.ADMIN, permission), \
                f"Admin missing permission: {permission.value}"
        
        print("[OK] Admin has all permissions")
    
    def test_user_has_correct_permissions(self):
        """Test that user role has correct permissions"""
        from core.permissions import AppRole, Permission, has_permission
        
        # User should have these permissions
        user_permissions = [
            Permission.MANAGE_OWN_SETTINGS,
            Permission.MANAGE_OWN_VOICES,
            Permission.MANAGE_STREAM,
            Permission.MANAGE_BOTS,
            Permission.MANAGE_COMMANDS,
            Permission.MANAGE_REWARDS,
            Permission.MANAGE_DROPS,
            Permission.VIEW_CHAT,
            Permission.VIEW_PUBLIC_DATA,
        ]
        
        for permission in user_permissions:
            assert has_permission(AppRole.USER, permission), \
                f"User missing permission: {permission.value}"
        
        # User should NOT have admin permissions
        admin_only_permissions = [
            Permission.MANAGE_USERS,
            Permission.MANAGE_GLOBAL_VOICES,
            Permission.VIEW_ALL_SETTINGS,
            Permission.MANAGE_SYSTEM,
            Permission.BLOCK_USERS,
        ]
        
        for permission in admin_only_permissions:
            assert not has_permission(AppRole.USER, permission), \
                f"User should not have permission: {permission.value}"
        
        print("[OK] User has correct permissions")
    
    def test_guest_has_limited_permissions(self):
        """Test that guest role has limited permissions"""
        from core.permissions import AppRole, Permission, has_permission
        
        # Guest should only have these permissions
        guest_permissions = [
            Permission.VIEW_CHAT,
            Permission.VIEW_PUBLIC_DATA,
        ]
        
        for permission in guest_permissions:
            assert has_permission(AppRole.GUEST, permission), \
                f"Guest missing permission: {permission.value}"
        
        # Guest should NOT have any other permissions
        for permission in Permission:
            if permission not in guest_permissions:
                assert not has_permission(AppRole.GUEST, permission), \
                    f"Guest should not have permission: {permission.value}"
        
        print("[OK] Guest has limited permissions")
    
    def test_platform_role_hierarchy(self):
        """Test platform role hierarchy"""
        from core.permissions import PLATFORM_ROLE_HIERARCHY, PlatformRole
        
        # Check hierarchy levels
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.BROADCASTER] == 5
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.OWNER] == 5
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.MODERATOR] == 4
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.VIP] == 3
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.SUBSCRIBER] == 2
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.VIEWER] == 1
        
        # Verify hierarchy order
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.BROADCASTER] > \
               PLATFORM_ROLE_HIERARCHY[PlatformRole.MODERATOR]
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.MODERATOR] > \
               PLATFORM_ROLE_HIERARCHY[PlatformRole.VIP]
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.VIP] > \
               PLATFORM_ROLE_HIERARCHY[PlatformRole.SUBSCRIBER]
        assert PLATFORM_ROLE_HIERARCHY[PlatformRole.SUBSCRIBER] > \
               PLATFORM_ROLE_HIERARCHY[PlatformRole.VIEWER]
        
        print("[OK] Platform role hierarchy is correct")
    
    def test_get_platform_roles_twitch(self):
        """Test getting platform roles for Twitch"""
        from core.permissions import get_platform_roles, PlatformRole
        
        # Create mock user with Twitch roles
        user = Mock()
        user.twitch_is_broadcaster = True
        user.twitch_is_moderator = False
        user.twitch_is_vip = False
        user.twitch_is_subscriber = True
        
        roles = get_platform_roles(user, 'twitch')
        
        assert PlatformRole.VIEWER in roles
        assert PlatformRole.BROADCASTER in roles
        assert PlatformRole.SUBSCRIBER in roles
        assert PlatformRole.MODERATOR not in roles
        assert PlatformRole.VIP not in roles
        
        print("[OK] Get platform roles for Twitch works correctly")
    
    def test_get_platform_roles_vk(self):
        """Test getting platform roles for VK"""
        from core.permissions import get_platform_roles, PlatformRole
        
        # Create mock user with VK roles
        user = Mock()
        user.vk_is_owner = False
        user.vk_is_moderator = True
        
        roles = get_platform_roles(user, 'vk')
        
        assert PlatformRole.VIEWER in roles
        assert PlatformRole.MODERATOR in roles
        assert PlatformRole.OWNER not in roles
        
        print("[OK] Get platform roles for VK works correctly")
    
    def test_has_platform_role(self):
        """Test platform role checking"""
        from core.permissions import has_platform_role, PlatformRole
        
        # Create mock broadcaster
        broadcaster = Mock()
        broadcaster.twitch_is_broadcaster = True
        broadcaster.twitch_is_moderator = False
        broadcaster.twitch_is_vip = False
        broadcaster.twitch_is_subscriber = False
        
        # Broadcaster should have all roles (hierarchy)
        assert has_platform_role(broadcaster, PlatformRole.BROADCASTER, 'twitch')
        assert has_platform_role(broadcaster, PlatformRole.MODERATOR, 'twitch')
        assert has_platform_role(broadcaster, PlatformRole.VIP, 'twitch')
        assert has_platform_role(broadcaster, PlatformRole.SUBSCRIBER, 'twitch')
        assert has_platform_role(broadcaster, PlatformRole.VIEWER, 'twitch')
        
        # Create mock moderator
        moderator = Mock()
        moderator.twitch_is_broadcaster = False
        moderator.twitch_is_moderator = True
        moderator.twitch_is_vip = False
        moderator.twitch_is_subscriber = False
        
        # Moderator should have moderator and below
        assert not has_platform_role(moderator, PlatformRole.BROADCASTER, 'twitch')
        assert has_platform_role(moderator, PlatformRole.MODERATOR, 'twitch')
        assert has_platform_role(moderator, PlatformRole.VIP, 'twitch')
        assert has_platform_role(moderator, PlatformRole.SUBSCRIBER, 'twitch')
        assert has_platform_role(moderator, PlatformRole.VIEWER, 'twitch')
        
        print("[OK] Platform role checking works correctly")
    
    def test_check_resource_ownership(self):
        """Test resource ownership checking"""
        from core.permissions import check_resource_ownership
        
        # Create mock user
        user = Mock()
        user.id = 123
        user.role = 'user'
        
        # User should own their own resources
        assert check_resource_ownership(user, 123) is True
        
        # User should not own other users' resources
        assert check_resource_ownership(user, 456) is False
        
        # Admin should own all resources
        admin = Mock()
        admin.id = 789
        admin.role = 'admin'
        
        assert check_resource_ownership(admin, 123) is True
        assert check_resource_ownership(admin, 456) is True
        assert check_resource_ownership(admin, 789) is True
        
        print("[OK] Resource ownership checking works correctly")
    
    def test_permission_decorators_exist(self):
        """Test that permission decorators exist"""
        from core.permissions import (
            require_permission,
            require_role,
            require_platform_role,
            require_ownership_or_admin
        )
        
        assert callable(require_permission)
        assert callable(require_role)
        assert callable(require_platform_role)
        assert callable(require_ownership_or_admin)
        
        print("[OK] Permission decorators exist")
    
    def test_role_hierarchy_completeness(self):
        """Test that role hierarchy is complete"""
        from core.permissions import ROLE_HIERARCHY, AppRole
        
        # All roles should be in hierarchy
        for role in AppRole:
            assert role in ROLE_HIERARCHY, f"Role {role.value} not in hierarchy"
        
        # Admin should have most permissions
        admin_perms = len(ROLE_HIERARCHY[AppRole.ADMIN])
        user_perms = len(ROLE_HIERARCHY[AppRole.USER])
        guest_perms = len(ROLE_HIERARCHY[AppRole.GUEST])
        
        assert admin_perms > user_perms
        assert user_perms > guest_perms
        
        print("[OK] Role hierarchy is complete")
    
    def test_permission_system_files_exist(self):
        """Test that permission system files exist"""
        permissions_file = Path("core/permissions.py")
        
        if not permissions_file.exists():
            print("[WARN] permissions.py not found")
        
        # Check file has required content
        with open(permissions_file, 'r') as f:
            content = f.read()
        
        assert 'class AppRole' in content
        assert 'class Permission' in content
        assert 'class PlatformRole' in content
        assert 'ROLE_HIERARCHY' in content
        assert 'require_permission' in content
        
        print("[OK] Permission system files exist and are complete")


def run_tests():
    """Run all permission system tests"""
    print("\n" + "="*60)
    print("TESTING PERMISSION SYSTEM")
    print("="*60 + "\n")
    
    test_suite = TestPermissionSystem()
    
    tests = [
        test_suite.test_app_roles_defined,
        test_suite.test_permissions_defined,
        test_suite.test_platform_roles_defined,
        test_suite.test_admin_has_all_permissions,
        test_suite.test_user_has_correct_permissions,
        test_suite.test_guest_has_limited_permissions,
        test_suite.test_platform_role_hierarchy,
        test_suite.test_get_platform_roles_twitch,
        test_suite.test_get_platform_roles_vk,
        test_suite.test_has_platform_role,
        test_suite.test_check_resource_ownership,
        test_suite.test_permission_decorators_exist,
        test_suite.test_role_hierarchy_completeness,
        test_suite.test_permission_system_files_exist,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"[ERROR] {test.__name__} failed: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "="*60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
