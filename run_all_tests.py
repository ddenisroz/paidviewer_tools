#!/usr/bin/env python3
"""
Comprehensive Test Runner
Runs all test suites and generates a summary report
"""
import subprocess
import sys
from pathlib import Path


def run_test_file(test_file: str) -> tuple[bool, str]:
    """
    Run a single test file and return results
    
    Args:
        test_file: Path to test file
        
    Returns:
        Tuple of (success, output)
    """
    try:
        result = subprocess.run(
            [sys.executable, test_file],
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.returncode == 0, result.stdout
    except subprocess.TimeoutExpired:
        return False, "Test timed out after 60 seconds"
    except Exception as e:
        return False, f"Error running test: {e}"


def main():
    """Run all tests and generate summary"""
    print("="*70)
    print("RUNNING ALL TEST SUITES")
    print("="*70)
    print()
    
    test_files = [
        ("Configuration System", "bot_service/tests/test_config.py"),
        ("Migration Scripts", "bot_service/tests/test_migration.py"),
        ("Platform Abstraction", "bot_service/tests/test_platform_abstraction.py"),
        ("Permission System", "bot_service/tests/test_permissions.py"),
        ("All Systems", "bot_service/tests/test_all_systems.py"),
    ]
    
    results = []
    total_passed = 0
    total_failed = 0
    
    for name, test_file in test_files:
        print(f"\n{'='*70}")
        print(f"Running: {name}")
        print(f"{'='*70}\n")
        
        success, output = run_test_file(test_file)
        
        # Print output
        print(output)
        
        # Parse results from output
        if "RESULTS:" in output:
            result_line = [line for line in output.split('\n') if 'RESULTS:' in line][0]
            results.append((name, success, result_line))
            
            # Extract numbers
            if "passed" in result_line:
                try:
                    passed = int(result_line.split("passed")[0].split()[-1])
                    failed = int(result_line.split("failed")[0].split()[-1])
                    total_passed += passed
                    total_failed += failed
                except:
                    pass
        else:
            results.append((name, success, "No results found"))
    
    # Print summary
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70 + "\n")
    
    for name, success, result in results:
        status = "[PASS]" if success else "[FAIL]"
        print(f"{status} - {name}")
        if result != "No results found":
            print(f"       {result.strip()}")
    
    print("\n" + "="*70)
    print(f"TOTAL: {total_passed} tests passed, {total_failed} tests failed")
    
    if total_failed == 0:
        print("[OK] ALL TESTS PASSED!")
    else:
        pass_rate = (total_passed / (total_passed + total_failed)) * 100
        print(f"[STATS] Pass Rate: {pass_rate:.1f}%")
    
    print("="*70 + "\n")
    
    # Exit with appropriate code
    sys.exit(0 if total_failed == 0 else 1)


if __name__ == "__main__":
    main()
