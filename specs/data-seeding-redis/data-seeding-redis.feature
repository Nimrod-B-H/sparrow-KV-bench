Feature: Automated Data Seeding for Redis 8.8.0
  To facilitate accurate benchmarking of memory layout and throughput metrics,
  the system must support an automated, high-performance, and idempotent data
  seeding process for Redis 8.8.0.

  Background:
    Given a running Redis 8.8.0 instance is accessible
    And the target keyspace is initialized and empty

  Scenario: Successful seeding with a small dataset
    Given the target dataset size is 100 records
    When the seeding process is executed
    Then the Redis keyspace should contain exactly 100 records
    And all keys and values should be 32 bits in size
    And the performance metrics should be reported

  Scenario: Successful seeding with a large dataset
    Given the target dataset size is 1,000,000 records
    When the seeding process is executed
    Then the Redis keyspace should contain exactly 1,000,000 records
    And all keys and values should be 32 bits in size
    And the performance metrics should be reported

  Scenario: Handling partial failure during data streaming
    Given the target dataset size is 1,000 records
    And a simulated network failure occurs during the seeding process
    When the seeding process is executed
    Then the script should retry or gracefully handle the error
    And the Redis keyspace should contain exactly 1,000 records
    And all keys and values should be 32 bits in size

  Scenario: Validation failure due to incomplete seeding
    Given the target dataset size is 1,000 records
    And only 999 records are successfully inserted
    When the seeding process is executed
    Then the script should detect the discrepancy
    And an error should be reported

  Scenario: Efficient bulk insertion
    Given the target dataset size is 10,000 records
    When the seeding process is executed using bulk insertion methods
    Then the data should be loaded with minimal round-trip latency
    And the Redis keyspace should contain exactly 10,000 records

  Scenario: Empty dataset
    Given the target dataset size is 0 records
    When the seeding process is executed
    Then the Redis keyspace should remain empty

  Scenario: Maximum dataset size
    Given the target dataset size is 4,294,967,296 records
    When the seeding process is executed
    Then the Redis keyspace should contain exactly 4,294,967,296 records
    And all keys and values should be 32 bits in size

  Scenario: Concurrent operations during seeding
    Given the target dataset size is 1,000 records
    And other processes are interacting with the Redis instance
    When the seeding process is executed
    Then the Redis keyspace should contain exactly 1,000 records
    And all keys and values should be 32 bits in size

  Scenario: Time-based performance metrics
    Given the target dataset size is 10,000 records
    When the seeding process is executed
    Then the performance metrics should include time in milliseconds
    And the performance metrics should include throughput in keys per second