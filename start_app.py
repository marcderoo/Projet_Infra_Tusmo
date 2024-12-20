import subprocess
import sys
import os


def run_tests():
    """
    Run all specified test files and return whether they pass.
    """
    test_files = [
        "mode_duel_test.py",
        "mode_battleIA_test.py",
        "solveur_test.py",
    ]

    for test_file in test_files:
        print(f"Running tests in {test_file}...")
        result = subprocess.run([sys.executable, "-m", "unittest", test_file], capture_output=True, text=True)

        if result.returncode != 0:
            print(f"❌ Tests failed in {test_file}:")
            print(result.stdout)
            print(result.stderr)
            return False

        print(f"✅ Tests passed in {test_file}.")

    return True


def start_flask_app():
    """
    Start the Flask application.
    """
    os.chdir("tusmo_web") 
    print("Starting Flask app...")
    subprocess.run([sys.executable, "app.py"])


if __name__ == "__main__":
    if run_tests():
        start_flask_app()
    else:
        print("❌ Tests failed. Flask app will not start.")