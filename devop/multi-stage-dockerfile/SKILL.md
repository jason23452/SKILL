---
name: multi-stage-dockerfile
description: 'Create optimized multi-stage Dockerfiles for any language or framework'
---

Your goal is to help me create efficient multi-stage Dockerfiles that follow best practices, resulting in smaller, more secure container images.

## Multi-Stage Structure

- Use a builder stage for compilation, dependency installation, and other build-time operations
- Use a separate runtime stage that only includes what's needed to run the application
- Copy only the necessary artifacts from the builder stage to the runtime stage
- Use meaningful stage names with the `AS` keyword (e.g., `FROM node:18 AS builder`)
- Place stages in logical order: dependencies → build → test → runtime

## Base Images

- Start with official, minimal base images when possible
- Specify exact version tags to ensure reproducible builds (e.g., `python:3.11-slim` not just `python`)
- Consider distroless images for runtime stages where appropriate
- Use Alpine-based images for smaller footprints when compatible with your application
- Ensure the runtime image has the minimal necessary dependencies

## Layer Optimization

- Organize commands to maximize layer caching
- Place commands that change frequently (like code changes) after commands that change less frequently (like dependency installation)
- Use `.dockerignore` to prevent unnecessary files from being included in the build context
- Combine related RUN commands with `&&` to reduce layer count
- Consider using COPY --chown to set permissions in one step

## Node.js and pnpm Dependency Policy

- In a Node/pnpm dependency stage, configure pnpm's minimum release age explicitly before running a frozen install.
- Default `PNPM_MINIMUM_RELEASE_AGE` to a non-zero value. Use `1440` minutes (24 hours) unless the project has an approved policy with a different value.
- Keep the package manifests ahead of the install step to preserve Docker layer caching.

```dockerfile
# After copying package.json and pnpm-lock.yaml into the dependency stage.
ARG PNPM_MINIMUM_RELEASE_AGE=1440

RUN corepack enable \
  && pnpm config set minimumReleaseAge "$PNPM_MINIMUM_RELEASE_AGE" \
  && printf 'PNPM_MINIMUM_RELEASE_AGE=%s\n' "$PNPM_MINIMUM_RELEASE_AGE" \
  && pnpm install --frozen-lockfile
```

- The `printf` makes the effective policy visible in Docker build logs. CI must retain that log, or explicitly record the selected build argument, so the exception is auditable.
- Only an approved development or emergency workflow may temporarily set the value to `0`:

```sh
docker build --build-arg PNPM_MINIMUM_RELEASE_AGE=0 .
```

- Do not unconditionally disable the waiting period for production deliveries.
- If the build fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, first identify it as pnpm's supply-chain release-age policy. Do not treat it as a corrupted lockfile or bypass it by changing the lockfile; use an approved exception or wait for the required age instead.

## Security Practices

- Avoid running containers as root - use `USER` instruction to specify a non-root user
- Remove build tools and unnecessary packages from the final image
- Scan the final image for vulnerabilities
- Set restrictive file permissions
- Use multi-stage builds to avoid including build secrets in the final image

## Performance Considerations

- Use build arguments for configuration that might change between environments
- Leverage build cache efficiently by ordering layers from least to most frequently changing
- Consider parallelization in build steps when possible
- Set appropriate environment variables like NODE_ENV=production to optimize runtime behavior
- Use appropriate healthchecks for the application type with the HEALTHCHECK instruction
