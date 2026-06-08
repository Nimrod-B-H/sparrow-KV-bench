Feature: Performance testing of Redis under varying loads
  To understand the performance characteristics of a Redis key-value database
  As a developer or system architect
  I want to test and document its behavior under different database sizes and concurrency levels

  Background:
    Given a local Redis instance is installed and running
    And the Redis version is 8.6.1
    And the system has sufficient resources for testing

  Scenario: Setting up the Redis database
    Given the setup script is executed
    When the database is populated with 1, 10, 100, 1000, and 10,000 keys
    Then the database contains the specified number of keys
    And the setup process completes without errors
    And the time taken for database population is logged

  Scenario: Running concurrency tests
    Given the database is populated with keys
    When the concurrency testing script is executed with varying levels of concurrency
    Then the time taken for requests is logged accurately
    And the system remains operational throughout the testing process
    And additional metrics such as CPU and memory usage are logged

  Scenario: Generating the performance report
    Given the performance results are logged
    When the `README.md` is generated
    Then it includes a summary of the testing objectives, methodology, results, and key insights
    And the report includes recommendations based on the results
    And the report is formatted for readability

  Scenario: Handling Redis instance not running
    Given the Redis instance is not running
    When the setup script is executed
    Then the script provides a meaningful error message and exits gracefully
    And the error message includes troubleshooting steps

  Scenario: Handling insufficient system resources
    Given the system resources are insufficient
    When the concurrency testing script is executed
    Then the script detects the issue and logs an appropriate error message
    And the script includes suggestions for resolving resource issues

  Scenario: Testing with a large database size
    Given the database is populated with 1,000,000 keys
    When the concurrency testing script is executed
    Then the system handles the load without crashing
    Or an appropriate error is logged
    And the system maintains consistent performance metrics across multiple runs