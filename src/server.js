const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const { gql } = require('apollo-server-express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');
require('dotenv').config();

// Initialize Prisma client
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const revokedTokens = new Set();

// Load GraphQL schema
const typeDefs = gql(fs.readFileSync(path.join(__dirname, '../schema/schema.graphql'), 'utf8'));

// Custom scalar for DateTime
const DateTimeResolver = new GraphQLScalarType({
    name: 'DateTime',
    description: 'Date custom scalar type',
    parseValue(value) {
        return new Date(value);
    },
    serialize(value) {
        return new Date(value).toISOString();
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
            return new Date(ast.value);
        }
        return null;
    },
});

// Authentication helper
const getUser = (context) => {
    const token = context.token;
    if (!token) {
        throw new Error('Authorization token missing');
    }

    if (revokedTokens.has(token)) {
        throw new Error('Token is revoked');
    }

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid token');
    }
};

// Helper function to encode cursor (base64 encoding of offset)
const encodeCursor = (offset) => Buffer.from(offset.toString()).toString('base64');

// Helper function to decode cursor
const decodeCursor = (cursor) => {
    try {
        return parseInt(Buffer.from(cursor, 'base64').toString());
    } catch {
        return 0;
    }
};

// Helper function to handle Relay-style pagination
const handleRelayPagination = (args) => {
    const { first, after, last, before, page = 1, pageSize = 20 } = args;

    // If using new Relay-style pagination
    if (first !== undefined || after !== undefined || last !== undefined || before !== undefined) {
        let offset = 0;
        let limit = first || last || 20;

        if (after) {
            offset = decodeCursor(after) + 1;
        }

        if (before) {
            const beforeOffset = decodeCursor(before);
            offset = Math.max(0, beforeOffset - limit);
        }

        return { offset, limit, isRelay: true };
    }

    // Fall back to legacy pagination
    const offset = (page - 1) * pageSize;
    return { offset, limit: pageSize, isRelay: false };
};

// Resolvers
const resolvers = {
    DateTime: DateTimeResolver,

    Query: {
        // Session
        me: async (_, __, context) => {
            try {
                const user = getUser(context);
                const trainee = await prisma.trainee.findUnique({
                    where: { id: user.traineeId },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        timezone: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });

                if (!trainee) {
                    return { authenticated: false, trainee: null };
                }

                return { authenticated: true, trainee };
            } catch (error) {
                return { authenticated: false, trainee: null };
            }
        },

        // Trainees with Relay pagination support
        trainees: async (_, args, context) => {
            getUser(context);
            const { offset, limit, isRelay } = handleRelayPagination(args);

            const [trainees, total] = await prisma.$transaction([
                prisma.trainee.findMany({
                    skip: offset,
                    take: limit,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        timezone: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }),
                prisma.trainee.count()
            ]);

            if (isRelay) {
                // Return Relay-style connection
                const edges = trainees.map((trainee, index) => ({
                    cursor: encodeCursor(offset + index),
                    node: trainee
                }));

                const pageInfo = {
                    hasNextPage: offset + limit < total,
                    hasPreviousPage: offset > 0,
                    startCursor: edges.length > 0 ? edges[0].cursor : null,
                    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
                };

                return {
                    edges,
                    pageInfo,
                    // Legacy fields for backward compatibility
                    data: trainees,
                    pagination: {
                        page: Math.floor(offset / limit) + 1,
                        pageSize: limit,
                        total
                    }
                };
            } else {
                // Return legacy pagination format with Relay fields for schema compliance
                const edges = trainees.map((trainee, index) => ({
                    cursor: encodeCursor(offset + index),
                    node: trainee
                }));

                const pageInfo = {
                    hasNextPage: offset + limit < total,
                    hasPreviousPage: offset > 0,
                    startCursor: edges.length > 0 ? edges[0].cursor : null,
                    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
                };

                return {
                    data: trainees,
                    pagination: {
                        page: args.page || 1,
                        pageSize: args.pageSize || 20,
                        total
                    },
                    edges,
                    pageInfo
                };
            }
        },

        trainee: async (_, { id }, context) => {
            getUser(context);
            const trainee = await prisma.trainee.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    timezone: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (!trainee) {
                throw new Error('Trainee not found');
            }

            return trainee;
        },

        // Workouts
        workouts: async (_, __, context) => {
            getUser(context);
            return await prisma.workout.findMany({
                orderBy: { createdAt: 'desc' }
            });
        },

        workout: async (_, { id }, context) => {
            getUser(context);
            const workout = await prisma.workout.findUnique({
                where: { id }
            });

            if (!workout) {
                throw new Error('Workout not found');
            }

            return workout;
        },

        // Routines
        routines: async (_, { traineeId }, context) => {
            getUser(context);
            const whereClause = traineeId ? { userId: traineeId } : {};

            const routines = await prisma.routine.findMany({
                where: whereClause,
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return routines.map(routine => ({
                ...routine,
                availability: JSON.parse(routine.availability)
            }));
        },

        traineeRoutine: async (_, { traineeId }, context) => {
            getUser(context);
            const routine = await prisma.routine.findFirst({
                where: { userId: traineeId },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });

            if (!routine) {
                throw new Error('Routine not found');
            }

            return {
                ...routine,
                availability: JSON.parse(routine.availability)
            };
        },

        // Registrations
        registrations: async (_, __, context) => {
            getUser(context);
            return await prisma.registration.findMany({
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        },

        registration: async (_, { id }, context) => {
            getUser(context);
            const registration = await prisma.registration.findUnique({
                where: { id },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });

            if (!registration) {
                throw new Error('Registration not found');
            }

            return registration;
        }
    },

    Mutation: {
        // Authentication
        login: async (_, { input }) => {
            const { email, password } = input;

            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            const trainee = await prisma.trainee.findUnique({
                where: { email }
            });

            if (!trainee || trainee.password !== password) {
                throw new Error('Invalid credentials');
            }

            const token = jwt.sign(
                { traineeId: trainee.id, email: trainee.email },
                JWT_SECRET,
                { expiresIn: '2h' }
            );

            const { password: userPassword, ...traineeWithoutPassword } = trainee;

            return {
                token,
                trainee: traineeWithoutPassword
            };
        },

        logout: async (_, __, context) => {
            const user = getUser(context);
            revokedTokens.add(context.token);
            return 'Successfully logged out';
        },

        // Registrations
        createRegistration: async (_, { input }, context) => {
            getUser(context);
            const { eventId, userId, inviteeEmail, startTime, endTime, status } = input;

            if (!eventId || !userId || !inviteeEmail || !startTime) {
                throw new Error('eventId, userId, inviteeEmail, and startTime are required');
            }

            const trainee = await prisma.trainee.findUnique({
                where: { id: userId }
            });

            if (!trainee) {
                throw new Error('Trainee not found');
            }

            return await prisma.registration.create({
                data: {
                    eventId,
                    userId,
                    inviteeEmail,
                    startTime: new Date(startTime),
                    endTime: endTime ? new Date(endTime) : null,
                    status: status || 'scheduled'
                },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });
        },

        // Routines
        createRoutine: async (_, { input }, context) => {
            getUser(context);
            const { userId, availability } = input;

            if (!userId || !availability) {
                throw new Error('userId and availability are required');
            }

            const trainee = await prisma.trainee.findUnique({
                where: { id: userId }
            });

            if (!trainee) {
                throw new Error('Trainee not found');
            }

            const newRoutine = await prisma.routine.create({
                data: {
                    userId,
                    availability: JSON.stringify(availability)
                },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });

            return {
                ...newRoutine,
                availability: JSON.parse(newRoutine.availability)
            };
        },

        // Trainees
        createTrainee: async (_, { input }) => {
            const { name, email, password, timezone } = input;

            if (!name || !email || !password) {
                throw new Error('Name, email, and password are required');
            }

            const existingTrainee = await prisma.trainee.findUnique({
                where: { email }
            });

            if (existingTrainee) {
                throw new Error('Email is already in use');
            }

            const newTrainee = await prisma.trainee.create({
                data: { name, email, password, timezone },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    timezone: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            return newTrainee;
        },

        // Workouts
        createWorkout: async (_, { input }, context) => {
            getUser(context);
            const { name, duration, description, color } = input;

            if (!name || !duration) {
                throw new Error('Name and duration are required');
            }

            return await prisma.workout.create({
                data: { name, duration, description, color }
            });
        },

        deleteRegistration: async (_, { id }, context) => {
            getUser(context);

            try {
                await prisma.registration.delete({
                    where: { id }
                });
                return 'Registration deleted successfully';
            } catch (error) {
                if (error.code === 'P2025') {
                    throw new Error('Registration not found');
                }
                throw error;
            }
        },

        deleteTrainee: async (_, { id }, context) => {
            getUser(context);

            try {
                await prisma.trainee.delete({
                    where: { id }
                });
                return 'Trainee deleted successfully';
            } catch (error) {
                if (error.code === 'P2025') {
                    throw new Error('Trainee not found');
                }
                throw error;
            }
        },

        deleteTraineeRoutine: async (_, { traineeId }, context) => {
            getUser(context);

            const deletedRoutine = await prisma.routine.deleteMany({
                where: { userId: traineeId }
            });

            if (deletedRoutine.count === 0) {
                throw new Error('Routine not found');
            }

            return 'Routine deleted successfully';
        },

        deleteWorkout: async (_, { id }, context) => {
            getUser(context);

            try {
                await prisma.workout.delete({
                    where: { id }
                });
                return 'Workout deleted successfully';
            } catch (error) {
                if (error.code === 'P2025') {
                    throw new Error('Workout not found');
                }
                throw error;
            }
        },

        updateRegistration: async (_, { id, input }, context) => {
            getUser(context);

            const updateData = {};
            if (input.eventId !== undefined) updateData.eventId = input.eventId;
            if (input.userId !== undefined) updateData.userId = input.userId;
            if (input.inviteeEmail !== undefined) updateData.inviteeEmail = input.inviteeEmail;
            if (input.startTime !== undefined) updateData.startTime = new Date(input.startTime);
            if (input.endTime !== undefined) updateData.endTime = input.endTime ? new Date(input.endTime) : null;
            if (input.status !== undefined) updateData.status = input.status;

            try {
                return await prisma.registration.update({
                    where: { id },
                    data: updateData,
                    include: {
                        trainee: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                timezone: true,
                                createdAt: true,
                                updatedAt: true
                            }
                        }
                    }
                });
            } catch (error) {
                if (error.code === 'P2025') {
                    throw new Error('Registration not found');
                }
                throw error;
            }
        },

        updateTrainee: async (_, { id, input }, context) => {
            getUser(context);

            const updateData = {};
            if (input.name !== undefined) updateData.name = input.name;
            if (input.email !== undefined) updateData.email = input.email;
            if (input.password !== undefined) updateData.password = input.password;
            if (input.timezone !== undefined) updateData.timezone = input.timezone;

            try {
                const updatedTrainee = await prisma.trainee.update({
                    where: { id },
                    data: updateData,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        timezone: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });

                return updatedTrainee;
            } catch (error) {
                if (error.code === 'P2025') {
                    throw new Error('Trainee not found');
                }
                throw error;
            }
        },

        updateTraineeRoutine: async (_, { traineeId, input }, context) => {
            getUser(context);
            const { availability } = input;

            if (!availability) {
                throw new Error('availability is required');
            }

            const updatedRoutine = await prisma.routine.updateMany({
                where: { userId: traineeId },
                data: {
                    availability: JSON.stringify(availability)
                }
            });

            if (updatedRoutine.count === 0) {
                throw new Error('Routine not found');
            }

            const routine = await prisma.routine.findFirst({
                where: { userId: traineeId },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });

            return {
                ...routine,
                availability: JSON.parse(routine.availability)
            };
        },

        updateWorkout: async (_, { id, input }, context) => {
            getUser(context);

            const updateData = {};
            if (input.name !== undefined) updateData.name = input.name;
            if (input.duration !== undefined) updateData.duration = input.duration;
            if (input.description !== undefined) updateData.description = input.description;
            if (input.color !== undefined) updateData.color = input.color;

            try {
                return await prisma.workout.update({
                    where: { id },
                    data: updateData
                });
            } catch (error) {
                if (error.code === 'P2025') {
                    throw new Error('Workout not found');
                }
                throw error;
            }
        }
    },

    // Field resolvers
    Trainee: {
        routines: async (trainee) => {
            const routines = await prisma.routine.findMany({
                where: { userId: trainee.id },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });

            return routines.map(routine => ({
                ...routine,
                availability: JSON.parse(routine.availability)
            }));
        },

        registrations: async (trainee) => {
            return await prisma.registration.findMany({
                where: { userId: trainee.id },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            timezone: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });
        }
    }
};

// Context function to extract token from headers
const context = ({ req }) => {
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    return { token };
};

// Create Apollo Server
const createServer = async () => {
    const app = express();

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context,
        introspection: true,
        playground: true
    });

    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });

    return { app, server };
};

// Start server if this file is run directly
if (require.main === module) {
    const PORT = process.env.GRAPHQL_PORT || 4000;

    createServer().then(({ app }) => {
        app.listen(PORT, () => {
            console.log(`GraphQL Server running on http://localhost:${PORT}/graphql`);
            console.log(`GraphQL Playground available at http://localhost:${PORT}/graphql`);
        });
    }).catch(error => {
        console.error('Error starting server:', error);
        process.exit(1);
    });
}

module.exports = { createServer };

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});