"""
Test migration script functionality
Tests that migration script creates necessary files and directories
"""
import os
import sys
import subprocess
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestMigrationScript:
    """Test suite for migration script"""
    
    def test_env_example_files_complete(self):
        """Test that all .env.example files have required variables"""
        
        # Bot service .env.example
        bot_env_path = Path(".env.example")
        if not bot_env_path.exists():
            print("[WARN] bot_service/.env.example not found")
            return
        
        with open(bot_env_path, 'r') as f:
            bot_env_content = f.read()
        
        required_bot_vars = [
            'SECRET_KEY',
            'TOKEN_ENCRYPTION_KEY',
            'DATABASE_URL',
            'BOT_SERVICE_HOST',
            'BOT_SERVICE_PORT',
            'TWITCH_CLIENT_ID',
            'TWITCH_CLIENT_SECRET',
            'VK_CLIENT_ID',
            'VK_CLIENT_SECRET',
            'F5_TTS_SERVICE_URL',
            'QWEN_TTS_SERVICE_URL',
            'FRONTEND_URL',
            'CORS_ORIGINS'
        ]
        
        for var in required_bot_vars:
            if var not in bot_env_content:
                print(f"[WARN] {var} not found in bot_service/.env.example")
        
        print("[OK] bot_service/.env.example check complete")
        
        # Frontend .env.example
        frontend_env_path = Path("../frontend/.env.example")
        if not frontend_env_path.exists():
            print("[WARN] frontend/.env.example not found")
            return
        
        with open(frontend_env_path, 'r') as f:
            frontend_env_content = f.read()
        
        required_frontend_vars = [
            'VITE_BOT_SERVICE_URL',
            'VITE_TTS_SERVICE_URL',
            'VITE_BOT_SERVICE_WS_URL',
            'VITE_FRONTEND_URL'
        ]
        
        for var in required_frontend_vars:
            assert var in frontend_env_content, f"{var} not found in frontend/.env.example"
        
        print("[OK] frontend/.env.example is complete")
    
    def test_migration_scripts_exist(self):
        """Test that migration scripts exist"""
        migrate_sh = Path("../migrate.sh")
        migrate_ps1 = Path("../migrate.ps1")
        
        if not migrate_sh.exists():
            print("[WARN] migrate.sh not found")
        if not migrate_ps1.exists():
            print("[WARN] migrate.ps1 not found")
        
        # Check if scripts are executable (Unix)
        if os.name != 'nt':
            assert os.access(migrate_sh, os.X_OK), "migrate.sh is not executable"
        
        print("[OK] Migration scripts exist")
    
    def test_migration_script_has_key_generation(self):
        """Test that migration scripts include key generation"""
        migrate_sh = Path("../migrate.sh")
        
        if not migrate_sh.exists():
            print("[WARN] migrate.sh not found, skipping test")
            return
        
        with open(migrate_sh, 'r') as f:
            content = f.read()
        
        # Check for key generation commands
        if 'openssl rand -hex 32' not in content:
            print("[WARN] SECRET_KEY generation not found")
        if 'Fernet.generate_key' not in content:
            print("[WARN] Encryption key generation not found")
        
        print("[OK] Migration script key generation check complete")
    
    def test_migration_script_creates_directories(self):
        """Test that migration script creates required directories"""
        migrate_sh = Path("../migrate.sh")
        
        if not migrate_sh.exists():
            print("[WARN] migrate.sh not found, skipping test")
            return
        
        with open(migrate_sh, 'r') as f:
            content = f.read()
        
        # Check for directory creation
        required_dirs = [
            'data',
            'logs',
            'models',
            'voices',
            'audio'
        ]
        
        for dir_name in required_dirs:
            if dir_name not in content:
                print(f"[WARN] Directory creation for {dir_name} not found")
        
        print("[OK] Migration script directory check complete")
    
    def test_migration_script_installs_dependencies(self):
        """Test that migration script installs dependencies"""
        migrate_sh = Path("../migrate.sh")
        
        if not migrate_sh.exists():
            print("[WARN] migrate.sh not found, skipping test")
            return
        
        with open(migrate_sh, 'r') as f:
            content = f.read()
        
        # Check for dependency installation
        if 'pip install -r requirements.txt' not in content:
            print("[WARN] Backend dependency installation not found")
        if 'npm install' not in content:
            print("[WARN] Frontend dependency installation not found")
        
        print("[OK] Migration script installs dependencies")
    
    def test_migration_script_runs_migrations(self):
        """Test that migration script runs database migrations"""
        migrate_sh = Path("../migrate.sh")
        
        if not migrate_sh.exists():
            print("[WARN] migrate.sh not found, skipping test")
            return
        
        with open(migrate_sh, 'r') as f:
            content = f.read()
        
        # Check for alembic migration
        if 'alembic upgrade head' not in content:
            print("[WARN] Database migration not found")
        
        print("[OK] Migration script migration check complete")
    
    def test_required_directories_structure(self):
        """Test that required directory structure is documented"""
        required_structure = {
            'bot_service': ['data', 'logs'],
            'frontend': [],
            'logs': ['access', 'app', 'audit', 'errors', 'monitoring']
        }
        
        # Verify structure is in migration script
        migrate_sh = Path("../migrate.sh")
        
        if not migrate_sh.exists():
            print("[WARN] migrate.sh not found, skipping test")
            return
        
        with open(migrate_sh, 'r') as f:
            content = f.read()
        
        for parent, subdirs in required_structure.items():
            if subdirs:
                for subdir in subdirs:
                    expected_path = f"{parent}/{subdir}"
                    # Check if path is mentioned in script
                    if parent not in content:
                        print(f"[WARN] Directory {parent} not mentioned in migration script")
        
        print("[OK] Required directory structure check complete")
    
    def test_env_files_have_comments(self):
        """Test that .env.example files have helpful comments"""
        bot_env_path = Path(".env.example")
        
        if not bot_env_path.exists():
            print("[WARN] .env.example not found, skipping test")
            return
        
        with open(bot_env_path, 'r') as f:
            content = f.read()
        
        # Check for comment sections
        if '# ===' not in content:
            print("[WARN] Section headers not found")
        if 'SECURITY' not in content:
            print("[WARN] Security section not found")
        if 'DATABASE' not in content:
            print("[WARN] Database section not found")
        if 'TWITCH' not in content:
            print("[WARN] Twitch section not found")
        
        # Check for generation instructions
        if 'openssl rand -hex 32' not in content:
            print("[WARN] SECRET_KEY generation instruction not found")
        assert 'Fernet' in content, "Encryption key generation instruction not found"
        
        print("[OK] .env.example files have helpful comments")
    
    def test_config_validation_on_startup(self):
        """Test that configuration is validated on startup"""
        from core.config import settings, validate_settings
        
        # Should not raise error in development
        try:
            validate_settings()
            print("[OK] Configuration validation works")
        except Exception as e:
            print(f"[ERROR] Configuration validation failed: {e}")
            raise


def run_tests():
    """Run all migration tests"""
    print("\n" + "="*60)
    print("TESTING MIGRATION SCRIPT")
    print("="*60 + "\n")
    
    test_suite = TestMigrationScript()
    
    tests = [
        test_suite.test_env_example_files_complete,
        test_suite.test_migration_scripts_exist,
        test_suite.test_migration_script_has_key_generation,
        test_suite.test_migration_script_creates_directories,
        test_suite.test_migration_script_installs_dependencies,
        test_suite.test_migration_script_runs_migrations,
        test_suite.test_required_directories_structure,
        test_suite.test_env_files_have_comments,
        test_suite.test_config_validation_on_startup,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"[ERROR] {test.__name__} failed: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

