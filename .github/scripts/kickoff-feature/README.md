# Kickoff Feature Automation - Structure

## Overview

This directory contains the kickoff feature automation system.

## Architecture

### Directory Structure

```
kickoff-feature/
├── index.js                    # Main orchestrator (entry point)
├── config.js                   # Configuration & env validation
├── logger.js                   # Structured logging
├── error-handler.js            # Centralized error handling
├── parsers/
│   ├── gherkin-parser.js      # Parse AI responses for Gherkin
│   └── feature-name-parser.js  # Extract feature names from paths
├── github/
│   ├── github-client.js       # Low-level API wrapper with retry
│   ├── branch-manager.js      # Branch operations
│   ├── file-manager.js        # File creation operations
│   ├── pr-manager.js          # Pull request operations
│   └── issue-manager.js       # Issue comment operations
└── templates/
    ├── step-definitions.js    # Generate step definition stubs
    ├── pr-body.js             # Generate PR descriptions
    └── issue-comment.js       # Generate issue comments
```

## Module Responsibilities

### Core Modules

#### `index.js` - Orchestrator
- **Purpose**: Coordinate all modules with minimal logic
- **Responsibilities**: 
  - Load configuration
  - Call appropriate modules in sequence
  - Handle high-level error flow
- **Dependencies**: All other modules

#### `config.js` - Configuration
- **Purpose**: Single source of truth for configuration
- **Responsibilities**:
  - Validate environment variables
  - Provide typed configuration object
  - Default values and path patterns
- **Dependencies**: None (pure)

#### `logger.js` - Structured Logging
- **Purpose**: Consistent logging throughout application
- **Responsibilities**:
  - Log levels (debug, info, warn, error)
  - Structured output with context
  - Performance timing helpers
- **Dependencies**: None (pure)

#### `error-handler.js` - Error Management
- **Purpose**: Centralized error handling
- **Responsibilities**:
  - Log errors with context
  - Post fallback comments to issues
  - Categorize errors for better UX
- **Dependencies**: logger, templates/issue-comment

### Parser Modules (Pure Functions)

#### `parsers/gherkin-parser.js`
- **Purpose**: Extract Gherkin from AI markdown responses
- **Responsibilities**:
  - Multiple extraction strategies (primary + fallbacks)
  - Validation of parsed content
  - Clear error messages
- **Dependencies**: logger
- **Testability**: ✅ Pure functions, easy to test

#### `parsers/feature-name-parser.js`
- **Purpose**: Parse feature metadata
- **Responsibilities**:
  - Extract feature name from file path
  - Generate branch names from issue data
  - Handle multiple path formats
- **Dependencies**: None (pure)
- **Testability**: ✅ Pure functions, easy to test

### GitHub Modules

#### `github/github-client.js`
- **Purpose**: Low-level GitHub API abstraction
- **Responsibilities**:
  - Make HTTPS requests to GitHub API
  - Retry logic with exponential backoff
  - Error enrichment and parsing
- **Dependencies**: logger
- **Features**: Rate limiting awareness, retryable status codes

#### `github/branch-manager.js`
- **Purpose**: Branch lifecycle operations
- **Responsibilities**:
  - Get default branch
  - Create branches (idempotent)
  - Check branch existence
- **Dependencies**: logger, github-client

#### `github/file-manager.js`
- **Purpose**: File operations
- **Responsibilities**:
  - Create/update files
  - Batch file creation (parallel)
  - Base64 encoding handling
- **Dependencies**: logger, github-client

#### `github/pr-manager.js`
- **Purpose**: Pull request operations
- **Responsibilities**:
  - Create pull requests
  - Add labels
  - Combined operations for efficiency
- **Dependencies**: logger, github-client

#### `github/issue-manager.js`
- **Purpose**: Issue operations
- **Responsibilities**:
  - Post comments
  - Add labels
- **Dependencies**: logger, github-client

### Template Modules (Pure Functions)

#### `templates/step-definitions.js`
- **Purpose**: Generate TypeScript step definition stubs
- **Responsibilities**: Create formatted TS file with imports
- **Dependencies**: None (pure)
- **Testability**: ✅ Pure function

#### `templates/pr-body.js`
- **Purpose**: Generate pull request markdown
- **Responsibilities**: Format PR body with links and analysis
- **Dependencies**: None (pure)
- **Testability**: ✅ Pure function

#### `templates/issue-comment.js`
- **Purpose**: Generate issue comment markdown
- **Responsibilities**: Success and failure comment templates
- **Dependencies**: None (pure)
- **Testability**: ✅ Pure function

## Execution Flow

```
1. Load Configuration (config.js)
   ↓
2. Initialize GitHub Client (github-client.js)
   ↓
3. Read AI Responses from /tmp files
   ↓
4. Parse Gherkin Content (parsers/gherkin-parser.js)
   ↓
5. Extract Metadata (parsers/feature-name-parser.js)
   ↓
6. Get Default Branch (github/branch-manager.js)
   ↓
7. Create Feature Branch (github/branch-manager.js)
   ↓
8. Generate File Content (templates/step-definitions.js)
   ↓
9. Create Files (github/file-manager.js) - Parallel
   ↓
10. Generate PR Body (templates/pr-body.js)
   ↓
11. Create Pull Request + Labels (github/pr-manager.js)
   ↓
12. Generate Success Comment (templates/issue-comment.js)
   ↓
13. Post Comment (github/issue-manager.js)
   ↓
14. ✅ Success

[On Error]
   ↓
Error Handler (error-handler.js)
   ↓
Generate Failure Comment (templates/issue-comment.js)
   ↓
Post Fallback Comment (github/issue-manager.js)
   ↓
❌ Exit with error
```


## Environment Variables

Required by `config.js`:

- `GITHUB_TOKEN` - GitHub API token
- `GITHUB_REPOSITORY` - Repository in format `owner/repo`
- `ISSUE_NUMBER` - GitHub issue number
- `ISSUE_TITLE` - GitHub issue title

Optional:

- `LOG_LEVEL` - Set to `DEBUG` for verbose logging (default: `INFO`)

