Feature: High-Concurrency Load Testing on Redis 8.8.0
  To ensure the performance and stability of the Redis instance under production-grade stress,
  the system must support high-concurrency load testing with accurate telemetry capture.

  The test runner seeds the database via seed-redis.ts with a configurable N before each
  dataset tier, runs GET and SET operations across concurrency tiers C=[10, 100]
  with C*100 operations per tier, samples CPU and memory every 200ms via a worker thread,
  and writes a single JSON report to reports/ covering all N x C combinations.
  A separate spike scenario tests a burst from C=100 to C=1000 on the largest dataset.

  Background:
    Given a Redis 8.8.0 instance has been seeded using seed-redis.ts with a configurable N
    And the test runner is initialized with a configurable GET/SET ratio defaulting to 80:20
    And GET operations target keys in the seeded range 0 to N-1
    And SET operations target keys above N to avoid polluting the seeded keyspace

  Rule: Concurrency tiers must be executed in sequence with full isolation
    Scenario Outline: Running a concurrency tier for a given dataset size
      Given the Redis keyspace is seeded with <N> keys
      When the test runner executes <C> concurrent workers each performing <ops> operations
      Then all connections must be torn down and re-allocated between tiers
      And latency percentiles P50, P95, P99 and max must be recorded for the tier
      And throughput in operations per second must be recorded for the tier

      Examples:
        | N       | C   | ops   |
        | 100     | 10  | 1000  |
        | 100     | 100 | 10000 |
        | 10000   | 10  | 1000  |
        | 10000   | 100 | 10000 |
        | 1000000 | 10  | 1000  |
        | 1000000 | 100 | 10000 |

  Rule: The concurrency spike must be tested on the largest dataset
    Scenario: Concurrency spike from 100 to 1000 workers on N=1000000
      Given the Redis keyspace is seeded with 1000000 keys
      When the test runner transitions directly from 100 to 1000 concurrent workers
      Then the Redis instance must remain accessible and responsive throughout the transition
      And the test runner must remain operational without crashing
      And the spike result must be recorded as a separate entry in the report

  Rule: Telemetry must be non-intrusive and sampled via a worker thread
    Scenario: CPU and memory are sampled without impacting benchmark operations
      Given a concurrency tier is actively executing operations
      When the telemetry worker thread samples system metrics every 200ms
      Then CPU usage percentage and RSS memory in MB must be recorded per sample
      And each sample must carry a wall clock timestamp relative to the start of the tier
      And the sampling must not block or delay the main benchmark event loop

  Rule: Errors must be handled gracefully
    Scenario: Handling transient Redis errors during a tier
      Given the Redis instance becomes temporarily unresponsive during a tier
      When the test runner is executing concurrent operations
      Then each error must be caught and logged with type and timestamp
      And the tier must complete and report the error count
      And the test runner must continue to the next tier without crashing

    Scenario: Handling Redis unavailability at tier start
      Given the Redis instance is not reachable when a tier begins
      When the test runner attempts to execute the tier
      Then the tier must be marked as failed in the report
      And the test runner must continue to subsequent tiers

  Rule: A structured JSON report must be written to reports/
    Scenario: Generating a complete performance report after all tiers
      Given all N x C tiers and the concurrency spike have completed
      When the test runner formats the final output
      Then a JSON file must be written to reports/ named redis-<ISO-timestamp>.json
      And the report must contain a meta section with timestamp, Redis version, GET/SET ratio, and host info
      And the report must contain a runs array with one entry per N value
      And each run entry must contain a concurrency_tiers array with latency, throughput, error count, and telemetry samples per tier
      And the report must contain a separate spike entry with its own latency, error, and stability data

    Scenario: Report includes error details when errors occurred
      Given one or more tiers encountered errors during execution
      When the report is written
      Then each affected tier must include an errors object with count and error type breakdown