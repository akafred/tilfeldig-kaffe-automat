const assert = require('assert');

const mockSlackUsers = [
    {
        id: 'U123',
        name: 'john.doe',
        deleted: false,
        is_bot: false,
        profile: {
            display_name: 'John Doe',
            real_name: 'John Doe'
        }
    },
    {
        id: 'U124',
        name: 'jane.smith',
        deleted: false,
        is_bot: false,
        profile: {
            display_name: '',
            real_name: 'Jane Smith'
        }
    },
    {
        id: 'U125',
        name: 'bot.user',
        deleted: false,
        is_bot: true,
        profile: {
            display_name: 'Bot User',
            real_name: 'Bot User'
        }
    },
    {
        id: 'U126',
        name: 'deleted.user',
        deleted: true,
        is_bot: false,
        profile: {
            display_name: 'Deleted User',
            real_name: 'Deleted User'
        }
    },
    {
        id: 'U127',
        name: 'username.only',
        deleted: false,
        is_bot: false,
        profile: {
            display_name: '',
            real_name: ''
        }
    }
];

async function runTests(app, channelMembersHandler, createChannelMembersHandler) {
    console.log('Running server tests...');
    
    let testsPassed = 0;
    let testsTotal = 0;
    
    async function test(description, testFn) {
        testsTotal++;
        try {
            await testFn();
            console.log(`✓ ${description}`);
            testsPassed++;
        } catch (error) {
            console.log(`✗ ${description}: ${error.message}`);
        }
    }
    
    await test('Should return 400 for missing token', async () => {
        const req = { body: { channelId: 'C123' } };
        const res = createMockResponse();
        
        await channelMembersHandler(req, res);
        
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.error, 'Token and channelId are required');
    });
    
    await test('Should return 400 for missing channelId', async () => {
        const req = { body: { token: 'xoxb-test' } };
        const res = createMockResponse();
        
        await channelMembersHandler(req, res);
        
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.error, 'Token and channelId are required');
    });
    
    await test('Should return 400 for empty request body', async () => {
        const req = { body: {} };
        const res = createMockResponse();
        
        await channelMembersHandler(req, res);
        
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.error, 'Token and channelId are required');
    });
    
    await test('Should return 400 for missing request body', async () => {
        const req = {};
        const res = createMockResponse();
        
        await channelMembersHandler(req, res);
        
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.error, 'Token and channelId are required');
    });
    
    await test('App should have the correct route configured', () => {
        const routes = [];
        app._router.stack.forEach(layer => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods);
                routes.push(`${methods[0].toUpperCase()} ${layer.route.path}`);
            }
        });
        
        assert(routes.includes('POST /api/slack/channel-members'), 
               `Expected route 'POST /api/slack/channel-members' not found. Found: ${routes.join(', ')}`);
    });
    
    await test('Should filter out bots and deleted users', async () => {
        const mockApiCall = (endpoint, token, params) => {
            if (endpoint === 'conversations.members') {
                return Promise.resolve({
                    ok: true,
                    members: ['U123', 'U124', 'U125', 'U126', 'U127'],
                    response_metadata: {}
                });
            } else if (endpoint === 'users.info') {
                const user = mockSlackUsers.find(u => u.id === params.user);
                return Promise.resolve(user ? { ok: true, user } : { ok: false, error: 'user_not_found' });
            }
        };
        
        const testHandler = createChannelMembersHandler(mockApiCall);
        const req = { body: { token: 'xoxb-test', channelId: 'C123' } };
        const res = createMockResponse();
        
        await testHandler(req, res);
        
        assert.strictEqual(res.statusCode, 200);
        const members = res.jsonData.members;
        
        // Should have 3 valid users: John Doe, Jane Smith, username.only
        assert.strictEqual(members.length, 3);
        assert(members.includes('@John Doe'));
        assert(members.includes('@Jane Smith'));
        assert(members.includes('@username.only'));
        assert(!members.some(m => m.includes('Bot User')));
        assert(!members.some(m => m.includes('Deleted User')));
    });
    
    await test('Should prioritize display_name over real_name over username', async () => {
        const mockApiCall = (endpoint, token, params) => {
            if (endpoint === 'conversations.members') {
                return Promise.resolve({
                    ok: true,
                    members: ['U123', 'U124', 'U127'],
                    response_metadata: {}
                });
            } else if (endpoint === 'users.info') {
                const user = mockSlackUsers.find(u => u.id === params.user);
                return Promise.resolve({ ok: true, user });
            }
        };
        
        const testHandler = createChannelMembersHandler(mockApiCall);
        const req = { body: { token: 'xoxb-test', channelId: 'C123' } };
        const res = createMockResponse();
        
        await testHandler(req, res);
        
        const members = res.jsonData.members;
        
        // Should use display_name for U123
        assert(members.includes('@John Doe'));
        
        // Should use real_name for U124 (display_name is empty)
        assert(members.includes('@Jane Smith'));
        
        // Should use username for U127 (both display_name and real_name are empty)
        assert(members.includes('@username.only'));
    });
    
    await test('Should handle Slack API errors gracefully', async () => {
        const mockApiCall = (endpoint, token, params) => {
            if (endpoint === 'conversations.members') {
                return Promise.resolve({
                    ok: false,
                    error: 'channel_not_found'
                });
            }
        };
        
        const testHandler = createChannelMembersHandler(mockApiCall);
        const req = { body: { token: 'xoxb-test', channelId: 'C123' } };
        const res = createMockResponse();
        
        await testHandler(req, res);
        
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.error, 'channel_not_found');
    });
    
    await test('Should handle pagination correctly', async () => {
        let callCount = 0;
        const mockApiCall = (endpoint, token, params) => {
            if (endpoint === 'conversations.members') {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        members: ['U123', 'U124'],
                        response_metadata: { next_cursor: 'next_page' }
                    });
                } else {
                    return Promise.resolve({
                        ok: true,
                        members: ['U127'],
                        response_metadata: {}
                    });
                }
            } else if (endpoint === 'users.info') {
                const user = mockSlackUsers.find(u => u.id === params.user);
                return Promise.resolve({ ok: true, user });
            }
        };
        
        const testHandler = createChannelMembersHandler(mockApiCall);
        const req = { body: { token: 'xoxb-test', channelId: 'C123' } };
        const res = createMockResponse();
        
        await testHandler(req, res);
        
        assert.strictEqual(res.statusCode, 200);
        const members = res.jsonData.members;
        
        // Should have all 3 users from both pages
        assert.strictEqual(members.length, 3);
        assert(members.includes('@John Doe'));
        assert(members.includes('@Jane Smith'));
        assert(members.includes('@username.only'));
    });
    
    console.log(`\nTest Results: ${testsPassed}/${testsTotal} tests passed`);
    
    if (testsPassed === testsTotal) {
        console.log('All tests passed! ✓');
    } else {
        console.log('Some tests failed! ✗');
        throw new Error(`${testsTotal - testsPassed} test(s) failed`);
    }
}

// Helper functions
function createMockResponse() {
    const res = {
        statusCode: 200,
        jsonData: null,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.jsonData = data;
            return this;
        }
    };
    return res;
}

// Make this file runnable standalone
if (require.main === module) {
    const { createApp, channelMembersHandler, createChannelMembersHandler } = require('./server.js');
    console.log('Running tests standalone...');
    const testApp = createApp();
    runTests(testApp, channelMembersHandler, createChannelMembersHandler).catch(console.error);
}

module.exports = { runTests };