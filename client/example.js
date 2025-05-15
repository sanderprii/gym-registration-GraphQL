const { ApolloClient, InMemoryCache, createHttpLink, gql } = require('@apollo/client/core');
require('cross-fetch/polyfill');

const GRAPHQL_URL = 'http://localhost:4000/graphql';

class GraphQLClient {
    constructor() {
        this.token = null;
        this.resetClient();
    }

    resetClient() {
        const httpLink = createHttpLink({
            uri: GRAPHQL_URL,
            headers: this.token ? { authorization: `Bearer ${this.token}` } : {}
        });

        this.client = new ApolloClient({
            link: httpLink,
            cache: new InMemoryCache(),
            defaultOptions: {
                watchQuery: {
                    errorPolicy: 'ignore',
                },
                query: {
                    errorPolicy: 'all',
                }
            }
        });
    }

    async login(email, password) {
        const mutation = gql`
            mutation Login($input: LoginInput!) {
                login(input: $input) {
                    token
                    trainee {
                        id
                        name
                        email
                        timezone
                    }
                }
            }
        `;

        try {
            const result = await this.client.mutate({
                mutation,
                variables: { input: { email, password } }
            });

            this.token = result.data.login.token;
            this.resetClient(); // Reset client with new token
            console.log('✓ Login successful:', result.data.login);
            return result.data.login;
        } catch (error) {
            console.error('✗ Login failed:', error.message);
            throw error;
        }
    }

    async logout() {
        const mutation = gql`
            mutation Logout {
                logout
            }
        `;

        try {
            const result = await this.client.mutate({
                mutation
            });

            console.log('✓ Logout successful:', result.data.logout);
            this.token = null;
            this.resetClient();
            return result.data.logout;
        } catch (error) {
            console.error('✗ Logout failed:', error.message);
            throw error;
        }
    }

    async createTrainee(traineeData) {
        const mutation = gql`
            mutation CreateTrainee($input: TraineeInput!) {
                createTrainee(input: $input) {
                    id
                    name
                    email
                    timezone
                    createdAt
                }
            }
        `;

        try {
            const result = await this.client.mutate({
                mutation,
                variables: { input: traineeData }
            });

            console.log('✓ Trainee created:', result.data.createTrainee);
            return result.data.createTrainee;
        } catch (error) {
            // Check if error is "Email already in use" and continue
            if (error.message && error.message.includes('Email is already in use')) {
                console.log('✓ Trainee already exists, continuing...');
                return null;
            }
            console.error('✗ Create trainee failed:', error.message);
            throw error;
        }
    }

    async getTrainees(page = 1, pageSize = 5) {
        const query = gql`
            query GetTrainees($page: Int, $pageSize: Int) {
                trainees(page: $page, pageSize: $pageSize) {
                    data {
                        id
                        name
                        email
                        timezone
                        createdAt
                    }
                    pagination {
                        page
                        pageSize
                        total
                    }
                }
            }
        `;

        try {
            const result = await this.client.query({
                query,
                variables: { page, pageSize }
            });

            console.log('✓ Trainees retrieved:', result.data.trainees);
            return result.data.trainees;
        } catch (error) {
            console.error('✗ Get trainees failed:', error.message);
            throw error;
        }
    }

    async createWorkout(workoutData) {
        const mutation = gql`
            mutation CreateWorkout($input: WorkoutInput!) {
                createWorkout(input: $input) {
                    id
                    name
                    duration
                    description
                    color
                    createdAt
                }
            }
        `;

        try {
            const result = await this.client.mutate({
                mutation,
                variables: { input: workoutData }
            });

            console.log('✓ Workout created:', result.data.createWorkout);
            return result.data.createWorkout;
        } catch (error) {
            console.error('✗ Create workout failed:', error.message);
            throw error;
        }
    }

    async getWorkouts() {
        const query = gql`
            query GetWorkouts {
                workouts {
                    id
                    name
                    duration
                    description
                    color
                    createdAt
                }
            }
        `;

        try {
            const result = await this.client.query({
                query
            });

            console.log('✓ Workouts retrieved:', result.data.workouts);
            return result.data.workouts;
        } catch (error) {
            console.error('✗ Get workouts failed:', error.message);
            throw error;
        }
    }

    async createRoutine(routineData) {
        const mutation = gql`
            mutation CreateRoutine($input: RoutineInput!) {
                createRoutine(input: $input) {
                    id
                    userId
                    availability {
                        day
                        startTime
                        endTime
                    }
                    trainee {
                        name
                        email
                    }
                    createdAt
                }
            }
        `;

        try {
            const result = await this.client.mutate({
                mutation,
                variables: { input: routineData }
            });

            console.log('✓ Routine created:', result.data.createRoutine);
            return result.data.createRoutine;
        } catch (error) {
            console.error('✗ Create routine failed:', error.message);
            throw error;
        }
    }

    async createRegistration(registrationData) {
        const mutation = gql`
            mutation CreateRegistration($input: RegistrationInput!) {
                createRegistration(input: $input) {
                    id
                    eventId
                    userId
                    inviteeEmail
                    startTime
                    endTime
                    status
                    trainee {
                        name
                        email
                    }
                    createdAt
                }
            }
        `;

        try {
            const result = await this.client.mutate({
                mutation,
                variables: { input: registrationData }
            });

            console.log('✓ Registration created:', result.data.createRegistration);
            return result.data.createRegistration;
        } catch (error) {
            console.error('✗ Create registration failed:', error.message);
            throw error;
        }
    }

    async getCurrentUser() {
        const query = gql`
            query Me {
                me {
                    authenticated
                    trainee {
                        id
                        name
                        email
                        timezone
                    }
                }
            }
        `;

        try {
            const result = await this.client.query({
                query
            });

            console.log('✓ Current user:', result.data.me);
            return result.data.me;
        } catch (error) {
            console.error('✗ Get current user failed:', error.message);
            throw error;
        }
    }
}

// Example usage
async function runExamples() {
    const client = new GraphQLClient();

    try {
        console.log('\n=== GraphQL Client Examples ===\n');

        // Create a test trainee (ignore if already exists)
        console.log('=== Creating Test Trainee ===');
        await client.createTrainee({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            timezone: 'Europe/Tallinn'
        });

        // Login with test user
        console.log('\n=== Logging in ===');
        await client.login('test@example.com', 'password123');

        // Check current user
        console.log('\n=== Checking Current User ===');
        const currentUser = await client.getCurrentUser();
        const testUserId = currentUser.trainee?.id;

        // Get trainees
        console.log('\n=== Getting Trainees ===');
        await client.getTrainees();

        // Create a workout
        console.log('\n=== Creating Workout ===');
        await client.createWorkout({
            name: 'HIIT Training',
            duration: 45,
            description: 'High intensity interval training',
            color: '#FF5733'
        });

        // Get workouts
        console.log('\n=== Getting Workouts ===');
        await client.getWorkouts();

        // Create a routine
        console.log('\n=== Creating Routine ===');
        if (testUserId) {
            await client.createRoutine({
                userId: testUserId,
                availability: [
                    { day: 'monday', startTime: '08:00', endTime: '10:00' },
                    { day: 'wednesday', startTime: '18:00', endTime: '20:00' }
                ]
            });
        }

        // Create a registration
        console.log('\n=== Creating Registration ===');
        if (testUserId) {
            const startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
            const endTime = new Date();
            endTime.setHours(endTime.getHours() + 2);

            await client.createRegistration({
                eventId: 'event-123',
                userId: testUserId,
                inviteeEmail: 'test@example.com',
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                status: 'scheduled'
            });
        }

        // Logout
        console.log('\n=== Logging out ===');
        await client.logout();

        console.log('\n✅ All GraphQL examples completed successfully!');

    } catch (error) {
        console.error('\n❌ Examples failed:', error.message);
        process.exit(1);
    }
}

// Run examples if this file is executed directly
if (require.main === module) {
    runExamples().then(() => {
        console.log('\n🎉 GraphQL examples completed!');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ GraphQL examples failed:', error);
        process.exit(1);
    });
}

module.exports = GraphQLClient;