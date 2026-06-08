Feature: Provision a Redis 8.8.0 instance directly on the host
  As a system administrator
  I want to automate the installation and setup of Redis 8.8.0 on any Unix/Linux host
  So that the system is prepared for high-concurrency benchmarking with minimal manual intervention

  Background:
    Given the host system is running a Unix/Linux environment
    And the script is executed with root privileges
    And the host system has internet access
    And the host system has at least 1 available CPU core

  Scenario: Provision Redis 8.8.0 on a clean host system
    Given Redis is not installed on the host
    When the script is executed
    Then the script should detect the host package manager
    And the official Redis repository from packages.redis.io should be added for the detected package manager
    And the required dependencies should be installed using the detected package manager
    And Redis 8.8.0 should be installed from the official Redis repository
    And the Redis instance should be verified to be running and responding with version 8.8.0
    And the script should emit a structured summary including Redis version, port, PID, and memory usage before and after provisioning

  Scenario: Ensure idempotency on repeated executions
    Given Redis 8.8.0 is already installed and running on the host
    When the script is executed again
    Then no redundant actions should be performed
    And the script should notify that Redis is already provisioned and exit cleanly

  Scenario: Handle unsupported package manager
    Given the host system uses a package manager not in the supported list
    When the script is executed
    Then the script should exit with a failure code
    And an error message should identify the detected package manager as unsupported
    And the message should list the supported package managers: apt, dnf, yum, zypper, and brew

  Scenario: Handle dependency installation failure
    Given the required dependencies are not installed
    And the package manager is unable to install a dependency
    When the script is executed
    Then the script should exit with a failure code
    And an error message should identify the failed dependency by name

  Scenario: Handle Redis repository registration failure
    Given the host uses a supported package manager
    And the official Redis repository cannot be added
    When the script is executed
    Then the script should exit with a failure code
    And an error message should indicate that the Redis repository registration failed

  Scenario: Resolve port conflict in interactive mode
    Given another process is using port 6379
    And the script is running in an interactive terminal session
    When the script is executed
    Then the script should display the conflicting process details
    And prompt the user for confirmation before terminating the conflicting process
    And if confirmed, terminate the process and continue provisioning
    And if not confirmed, exit cleanly without making changes

  Scenario: Resolve port conflict in non-interactive mode
    Given another process is using port 6379
    And the script is running non-interactively such as in a CI pipeline
    When the script is executed
    Then the script should exit with a failure code
    And an error message should identify the conflicting process and instruct the operator to free the port manually or re-run interactively
    And the script should support a --force-kill-port flag to allow automated termination when explicitly provided

  Scenario: Handle insufficient host resources
    Given the host system has fewer than 1 available CPU core
    When the script is executed
    Then the script should exit with a failure code
    And an error message should indicate the resource constraint

  Scenario: Verify Redis version mismatch after installation
    Given Redis is installed but reports a version other than 8.8.0
    When the script verifies the installed Redis instance
    Then the script should exit with a failure code
    And an error message should indicate the detected version and the expected version

  Scenario: Log memory usage before and after provisioning
    Given the host system has available memory
    When the script provisions Redis 8.8.0
    Then the script should log free memory before provisioning starts
    And the script should log free memory after provisioning completes
    And both values should be included in the structured summary emitted to stdout