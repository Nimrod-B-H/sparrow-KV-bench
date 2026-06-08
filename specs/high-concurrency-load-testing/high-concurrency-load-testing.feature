Feature: High-Concurrency Load Testing on Redis 8.8.0
  To ensure the performance and stability of the Redis instance under production-grade stress,
  the system must support high-concurrency load testing with accurate telemetry capture.

  Background:
    Given a Redis 8.8.0 instance pre-populated with a uniform dataset of fixed-width 32-bit keys
    And the test runner is initialized with sufficient resources

  Rule: Telemetry must be accurate and non-intrusive
    Scenario: Capturing latency and throughput metrics
      When the test runner executes a mix of GET and SET operations with 10 concurrent workers
      Then the system must capture latency metrics at sub-millisecond precision
      And the system must capture throughput metrics in operations per second

    Scenario Outline: Validating telemetry with varying key sizes and operation ratios
      Given a Redis 8.8.0 instance pre-populated with <key_size> keys
      When the test runner executes a mix of GET and SET operations with <operation_ratio> ratio
      Then the system must capture accurate latency and throughput metrics

      Examples:
        | key_size | operation_ratio |
        | small    | 80:20           |
        | medium   | 50:50           |
        | large    | 20:80           |

  Rule: The system must remain stable under high concurrency
    Scenario: High-concurrency stress test
      When the test runner executes a mix of GET and SET operations with 1000 concurrent workers
      Then the Redis instance must remain accessible and responsive
      And the test runner must remain operational without crashing

    Scenario: Handling concurrency spikes
      When the test runner increases concurrency from 100 to 1000 workers within 1 second
      Then the Redis instance must remain accessible and responsive
      And the test runner must remain operational without crashing

  Rule: Errors must be handled gracefully
    Scenario: Handling transient errors during load testing
      Given the Redis instance becomes temporarily unresponsive
      When the test runner executes a mix of GET and SET operations
      Then the system must log the error with sufficient detail
      And the test runner must continue to the next test iteration

    Scenario: Handling Redis crash during load testing
      Given the Redis instance crashes during a test iteration
      When the test runner executes a mix of GET and SET operations
      Then the system must log the error with sufficient detail
      And the test runner must exit gracefully

  Rule: Resource telemetry must reflect system state
    Scenario: Monitoring CPU and memory usage
      When the test runner executes a mix of GET and SET operations with 500 concurrent workers
      Then the system must capture CPU and memory usage for the host machine
      And the telemetry data must match external system monitoring tools

    Scenario: Resource contention with multiple test runners
      Given multiple test runners are operating simultaneously
      When each test runner executes a mix of GET and SET operations with 100 concurrent workers
      Then the system must capture accurate resource telemetry for each runner

  Rule: A structured performance report must be generated
    Scenario: Generating a performance report
      When the test runner completes all test iterations
      Then a structured performance report must be generated in JSON format
      And the report must include latency, throughput, and resource usage metrics for each concurrency tier

    Scenario: Including error logs in the performance report
      When the test runner encounters errors during a test iteration
      Then the performance report must include detailed error logs and anomalies