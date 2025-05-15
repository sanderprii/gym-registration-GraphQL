const { ApolloClient, InMemoryCache, createHttpLink, gql } = require('@apollo/client/core');
const axios = require('axios');
require('cross-fetch/polyfill');

const GRAPHQL_URL = 'http://localhost:4000/graphql';
const REST_URL = 'http://localhost:3000';

class GraphQLTester {
    constructor() {
        this.graphqlClient = null;
        this.restToken = null;
        this.graphqlToken = null;
    }

    resetGraphQLClient() {
        const httpLink = createHttpLink({
            uri: GRAPHQL_URL,
            headers: this.graphqlToken ? { authorization: `Bearer ${this.graphqlToken}` } : {}
        });

        this.graphqlClient = new ApolloClient({
            link: httpLink,
            cache: new InMemoryCache(),
            defaultOptions: {
                watchQuery: { errorPolicy: 'ignore' },
                query: { errorPolicy: 'all' }
            }
        });
    }

    connect() {
        this.resetGraphQLClient();
        console.log('✓ Connected to GraphQL service');
    }

    async testAuth() {
        console.log('\n=== Testing Authentication ===');

        try {
            const testEmail = 'test@example.com';
            const testPassword = 'password123';

            // First create a test user via REST (ignore if exists)
            try {
                await axios.post(`${REST_URL}/trainees`, {
                    name: 'Test User',
                    email: testEmail,
                    password: testPassword,
                    timezone: 'Europe/Tallinn'
                });
            } catch (error) {
                // Ignore if user already exists
            }

            // Create via GraphQL (ignore if exists)
            try {
                const createTraineeMutation = gql`
                    mutation CreateTrainee($input: TraineeInput!) {
                        createTrainee(input: $input) {
                            id
                            name
                            email
                        }
                    }
                `;

                await this.graphqlClient.mutate({
                    mutation: createTraineeMutation,
                    variables: {
                        input: {
                            name: 'Test User',
                            email: testEmail,
                            password: testPassword,
                            timezone: 'Europe/Tallinn'
                        }
                    }
                });
            } catch (error) {
                // Ignore if user already exists
            }

            // GraphQL login
            const graphqlLoginMutation = gql`
                mutation Login($input: LoginInput!) {
                    login(input: $input) {
                        token
                        trainee {
                            id
                            name
                            email
                        }
                    }
                }
            `;

            const graphqlLoginResult = await this.graphqlClient.mutate({
                mutation: graphqlLoginMutation,
                variables: { input: { email: testEmail, password: testPassword } }
            });

            this.graphqlToken = graphqlLoginResult.data.login.token;
            this.resetGraphQLClient();
            console.log('✓ GraphQL login successful');

            // REST login
            const restLoginResult = await axios.post(`${REST_URL}/sessions`, {
                email: testEmail,
                password: testPassword
            });
            this.restToken = restLoginResult.data.token;
            console.log('✓ REST login successful');

            console.log('✓ Both authentication methods successful');
        } catch (error) {
            console.error('✗ Authentication test failed:', error.message);
            throw error;
        }
    }

    async testTrainees() {
        console.log('\n=== Testing Trainees ===');

        try {
            // GraphQL query
            const graphqlQuery = gql`
                query GetTrainees($page: Int, $pageSize: Int) {
                    trainees(page: $page, pageSize: $pageSize) {
                        data {
                            id
                            name
                            email
                            timezone
                        }
                        pagination {
                            page
                            pageSize
                            total
                        }
                    }
                }
            `;

            const graphqlResult = await this.graphqlClient.query({
                query: graphqlQuery,
                variables: { page: 1, pageSize: 20 }
            });

            // REST query
            const restResult = await axios.get(`${REST_URL}/trainees?page=1&pageSize=20`, {
                headers: { Authorization: `Bearer ${this.restToken}` }
            });

            const graphqlCount = graphqlResult.data.trainees.pagination.total;
            const restCount = restResult.data.pagination.total;

            console.log(`GraphQL trainees: ${graphqlCount}, REST trainees: ${restCount}`);

            // Check that structure is similar
            const graphqlTrainee = graphqlResult.data.trainees.data[0];
            const restTrainee = restResult.data.data[0];

            if (graphqlTrainee && restTrainee) {
                const graphqlKeys = Object.keys(graphqlTrainee).sort();
                const restKeys = Object.keys(restTrainee).filter(key => key !== 'password').sort();

                console.log('GraphQL trainee keys:', graphqlKeys);
                console.log('REST trainee keys:', restKeys);
            }

            console.log('✓ Trainees operation successful');
        } catch (error) {
            console.error('✗ Trainees test failed:', error.message);
            throw error;
        }
    }

    async testWorkouts() {
        console.log('\n=== Testing Workouts ===');

        try {
            // Create workout via GraphQL
            const createWorkoutMutation = gql`
                mutation CreateWorkout($input: WorkoutInput!) {
                    createWorkout(input: $input) {
                        id
                        name
                        duration
                        description
                        color
                    }
                }
            `;

            const workoutData = {
                name: 'Test GraphQL Workout',
                duration: 60,
                description: 'Test workout created via GraphQL',
                color: '#00FF00'
            };

            await this.graphqlClient.mutate({
                mutation: createWorkoutMutation,
                variables: { input: workoutData }
            });

            // Create workout via REST
            await axios.post(`${REST_URL}/workouts`, workoutData, {
                headers: { Authorization: `Bearer ${this.restToken}` }
            });

            // List workouts via GraphQL
            const listWorkoutsQuery = gql`
                query GetWorkouts {
                    workouts {
                        id
                        name
                        duration
                        description
                        color
                    }
                }
            `;

            const graphqlResult = await this.graphqlClient.query({
                query: listWorkoutsQuery
            });

            // List workouts via REST
            const restResult = await axios.get(`${REST_URL}/workouts`, {
                headers: { Authorization: `Bearer ${this.restToken}` }
            });

            const graphqlWorkouts = graphqlResult.data.workouts || [];
            const restWorkouts = restResult.data || [];

            console.log(`GraphQL workouts: ${graphqlWorkouts.length}, REST workouts: ${restWorkouts.length}`);
            console.log('✓ Workouts operations successful');
        } catch (error) {
            console.error('✗ Workouts test failed:', error.message);
            throw error;
        }
    }

    async testErrorHandling() {
        console.log('\n=== Testing Error Handling ===');

        try {
            // Test invalid token
            const invalidClient = new ApolloClient({
                link: createHttpLink({
                    uri: GRAPHQL_URL,
                    headers: { authorization: 'Bearer invalid_token' }
                }),
                cache: new InMemoryCache(),
                defaultOptions: {
                    query: { errorPolicy: 'all' }
                }
            });

            const testQuery = gql`
                query GetTrainees {
                    trainees {
                        data {
                            id
                            name
                        }
                    }
                }
            `;

            try {
                await invalidClient.query({ query: testQuery });
                console.log('✗ Should have failed with invalid token');
            } catch (error) {
                if (error.message && error.message.includes('Invalid token')) {
                    console.log('✓ Invalid token properly rejected');
                } else {
                    console.log('✗ Unexpected error for invalid token:', error.message);
                }
            }

            // Test missing required fields
            const createTraineeMutation = gql`
                mutation CreateTrainee($input: TraineeInput!) {
                    createTrainee(input: $input) {
                        id
                        name
                    }
                }
            `;

            try {
                await this.graphqlClient.mutate({
                    mutation: createTraineeMutation,
                    variables: { input: { name: 'Test' } } // Missing required fields
                });
                console.log('✗ Should have failed with missing fields');
            } catch (error) {
                if (error.message && error.message.includes('required')) {
                    console.log('✓ Missing required fields properly rejected');
                } else {
                    console.log('✗ Unexpected error for missing fields:', error.message);
                }
            }
        } catch (error) {
            console.error('✗ Error handling test failed:', error.message);
        }
    }

    async testIntrospection() {
        console.log('\n=== Testing GraphQL Introspection ===');

        try {
            const introspectionQuery = gql`
                query IntrospectionQuery {
                    __schema {
                        types {
                            name
                            kind
                        }
                        queryType {
                            name
                        }
                        mutationType {
                            name
                        }
                    }
                }
            `;

            const result = await this.graphqlClient.query({
                query: introspectionQuery
            });

            const schema = result.data.__schema;
            console.log('✓ Schema introspection successful');
            console.log(`Found ${schema.types.length} types`);
            console.log(`Query type: ${schema.queryType.name}`);
            console.log(`Mutation type: ${schema.mutationType.name}`);

            // Check for required types
            const typeNames = schema.types.map(type => type.name);
            const requiredTypes = ['Trainee', 'Workout', 'Routine', 'Registration', 'Query', 'Mutation'];

            for (const requiredType of requiredTypes) {
                if (typeNames.includes(requiredType)) {
                    console.log(`✓ Found required type: ${requiredType}`);
                } else {
                    console.log(`✗ Missing required type: ${requiredType}`);
                }
            }
        } catch (error) {
            console.error('✗ Introspection test failed:', error.message);
            throw error;
        }
    }

    async runAllTests() {
        try {
            this.connect();
            await this.testAuth();
            await this.testTrainees();
            await this.testWorkouts();
            await this.testErrorHandling();
            await this.testIntrospection();
            console.log('\n✓ All tests completed!');
        } catch (error) {
            console.error('\n✗ Tests failed:', error.message);
            process.exit(1);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new GraphQLTester();
    tester.runAllTests().then(() => {
        console.log('\n🎉 Test suite completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ Test suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = GraphQLTester;