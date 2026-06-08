Feature: Automated Data Seeding for Redis 8.8.0
  To facilitate accurate benchmarking of key existence and throughput metrics,
  the system must support an automated, high-performance, and idempotent data
  seeding process for Redis 8.8.0.
  The seeding script accepts N as a command-line argument, flushes the target
  keyspace before seeding, and populates Redis with N keys encoded as 32-bit
  big-endian unsigned integers. Values are fixed markers and are not part of
  the benchmark. Actual performance testing is handled by a separate script.

  Background:
    Given a running Redis 8.8.0 instance is accessible on port 6379
    And the seeding script is invoked with a valid N argument

  Scenario: Successful seeding with a small dataset
    Given N is 100
    When the seeding script is executed
    Then the keyspace should be flushed before seeding begins
    And the Redis keyspace should contain exactly 100 keys after seeding
    And the performance report should include total time in milliseconds and throughput in keys per second

  Scenario: Successful seeding with a medium dataset
    Given N is 10,000
    When the seeding script is executed
    Then the keyspace should be flushed before seeding begins
    And the Redis keyspace should contain exactly 10,000 keys after seeding
    And the performance report should include total time in milliseconds and throughput in keys per second

  Scenario: Successful seeding with a large dataset
    Given N is 1,000,000
    When the seeding script is executed
    Then the keyspace should be flushed before seeding begins
    And the Redis keyspace should contain exactly 1,000,000 keys after seeding
    And the performance report should include total time in milliseconds and throughput in keys per second

  Scenario: Keys are encoded as 32-bit big-endian unsigned integers
    Given N is 100
    When the seeding script is executed
    Then every key in the keyspace should be exactly 4 bytes in length
    And keys should represent the integers 0 through N-1 encoded as big-endian UInt32

  Scenario: Batched insertion for large datasets
    Given N is 1,000,000
    When the seeding script is executed
    Then commands should be sent in batches to avoid memory buffer overflows
    And the Redis keyspace should contain exactly 1,000,000 keys after seeding

  Scenario: Handling partial failure during data streaming
    Given N is 1,000
    And a simulated network failure occurs during the seeding process
    When the seeding script is executed
    Then the script should detect and report the error
    And the keyspace should not be left in a partially seeded state without an error being raised

  Scenario: Validation failure due to incomplete seeding
    Given N is 1,000
    And only 999 keys are successfully inserted
    When the seeding script verifies the keyspace
    Then the script should detect the DBSIZE mismatch
    And exit with a failure code and a message indicating expected vs actual key count

  Scenario: Empty dataset
    Given N is 0
    When the seeding script is executed
    Then the keyspace should be flushed
    And the Redis keyspace should remain empty

  Scenario: Invalid N argument
    Given the seeding script is invoked without an N argument or with a non-integer value
    When the seeding script is executed
    Then the script should exit with a failure code
    And an error message should describe the expected argument format