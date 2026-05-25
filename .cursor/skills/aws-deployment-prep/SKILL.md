---
name: aws-deployment-prep
description: Check environment variables, verify AWS RDS connection configuration, and validate frontend build readiness for AWS Amplify before deployment. Use when preparing a project for AWS deployment and wanting a preflight review of configuration and build readiness.
---

# AWS Deployment Prep

## Purpose

Prepare a project for AWS deployment by reviewing environment variables, verifying AWS RDS connection settings, and checking that the frontend build is ready for AWS Amplify.

## When to use

Use this skill when you want a pre-deployment review for AWS, especially when:

- environment variables may be missing or mismatched
- backend services connect to AWS RDS
- frontend needs to build cleanly for AWS Amplify
- you want actionable deployment recommendations before pushing

## What to check

### 1. Environment variables

Review the repo for:

- required frontend environment variables
- required backend environment variables
- missing `.env` / `.env.example` coverage
- hardcoded local-only values
- references to secrets that should live in AWS or deployment settings

Flag variables that are:

- undefined
- inconsistent across environments
- named differently in code vs docs vs deployment config
- likely to break in Amplify or production

### 2. AWS RDS connection configuration

Inspect the backend database configuration for:

- host, port, database name, username, password wiring
- SSL or TLS requirements
- JDBC / datasource URL formatting
- connection pooling defaults
- environment-driven config vs hardcoded values

Check for likely deployment issues such as:

- localhost or private development hostnames
- missing SSL parameters when production expects them
- credentials stored directly in code
- database URLs that do not match AWS RDS conventions

### 3. Frontend build readiness for AWS Amplify

Check that the frontend can be built in a deployment environment by reviewing:

- build scripts in `package.json`
- framework-specific build output requirements
- environment variables used during build
- imports or code paths that depend on local-only resources
- lint or type issues that would block build success

Prefer to verify whether the app is ready for a production build rather than only checking local runtime assumptions.

## Output format

Return results in this order:

1. **Overall status**
   - `ready`
   - `needs-fix`
   - `needs-review`

2. **Checks performed**
   - environment variables
   - AWS RDS config
   - Amplify build readiness

3. **Findings**
   - list issues by severity
   - explain the likely deployment impact

4. **Recommendations**
   - concrete next steps
   - file names or config areas to inspect
   - suggested environment variable names or config patterns

5. **Deployment notes**
   - call out anything that may need manual confirmation in AWS Console, Amplify, or RDS

## Decision rules

- Mark `ready` only if no blocking issues are found.
- Mark `needs-fix` if a missing variable, broken DB config, or build failure will likely block deploy.
- Mark `needs-review` if the configuration looks plausible but some AWS-specific detail cannot be confirmed from code alone.

## Safety rules

- Do not invent environment variables that are not present in the repo.
- Do not assume AWS defaults unless they are explicit in the project.
- Do not recommend changing secrets into source control.
- Prefer narrow, repo-specific recommendations over generic AWS advice.
- If the project has multiple apps or services, identify which one the checks apply to.

## Preferred behavior

- Be concise but specific.
- Point to exact files or config locations when possible.
- Focus on deployment blockers first.
- If you find a likely issue, explain both the cause and the fix.
