#!/bin/bash

echo "Running automated tests for GraphQL service..."

# Check if GraphQL service is running
echo "Checking if GraphQL service is running..."
# Use a simple introspection query to check if GraphQL is responding
if ! curl -X POST -H "Content-Type: application/json" -d '{"query":"query {__typename}"}' http://localhost:4000/graphql > /dev/null 2>&1; then
    echo "Error: GraphQL service is not running on port 4000"
    echo "Please start it with: ./scripts/run.sh"
    exit 1
fi

# Check if REST service is running
echo "Checking if REST service is running..."
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "Warning: REST service is not running on port 3000"
    echo "Some comparison tests will be skipped"
fi

# Run Node.js tests
echo "Running GraphQL comparison tests..."
cd "$(dirname "$0")"
node test.js

if [ $? -eq 0 ]; then
    echo "✓ All tests passed successfully!"
    exit 0
else
    echo "✗ Some tests failed!"
    exit 1
fi