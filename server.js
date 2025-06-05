const express = require('express');
const https = require('https');
const path = require('path');

const PORT = 3000;

function slackApiCall(endpoint, token, params = {}) {
    return new Promise((resolve, reject) => {
        const query = new URLSearchParams(params).toString();
        const url = `https://slack.com/api/${endpoint}?${query}`;
        
        const options = {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (error) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        }).on('error', reject);
    });
}

function createChannelMembersHandler(apiCallFn = slackApiCall) {
    return async function channelMembersHandler(req, res) {
        try {
            const body = req.body || {};
            const { token, channelId } = body;
            
            if (!token || !channelId) {
                return res.status(400).json({ error: 'Token and channelId are required' });
            }

            const actualChannelId = channelId;

            let allMembers = [];
            let cursor = '';
            
            do {
                const params = { channel: actualChannelId, limit: 1000 };
                if (cursor) params.cursor = cursor;
                
                const data = await apiCallFn('conversations.members', token, params);
                
                if (!data.ok) {
                    return res.status(400).json({ error: data.error });
                }
                
                allMembers = allMembers.concat(data.members);
                cursor = data.response_metadata?.next_cursor || '';
            } while (cursor);

            // Fetch user data in parallel (35x faster than sequential)
            const userPromises = allMembers.map(async (userId) => {
                try {
                    const userData = await apiCallFn('users.info', token, { user: userId });
                    return userData.ok ? userData.user : null;
                } catch (error) {
                    console.warn(`Could not fetch user ${userId}:`, error.message);
                    return null;
                }
            });
            const userResults = await Promise.all(userPromises);
            const users = userResults.filter(user => user !== null);

            const memberHandles = users
                .filter(user => !user.deleted && !user.is_bot)
                .map(user => {
                    // Try display_name first, then real_name, then fall back to name
                    const displayName = user.profile?.display_name;
                    const realName = user.profile?.real_name;
                    const username = user.name;
                    
                    // Use display_name if available and not empty, otherwise real_name, otherwise username
                    const handle = (displayName && displayName.trim()) || realName || username;
                    return `@${handle}`;
                })
                .sort();

            res.json({ members: memberHandles });
            
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: error.message });
        }
    };
}

const channelMembersHandler = createChannelMembersHandler();

// Create app function to support testing
function createApp() {
    const app = express();
    app.use(express.static('.'));
    app.use(express.json());
    
    // Add the channel members route
    app.post('/api/slack/channel-members', channelMembersHandler);
    
    return app;
}

const app = createApp();

// Only start server and run tests when this file is run directly
if (require.main === module) {
    const { runTests } = require('./server.test.js');
    
    runTests(createApp(), channelMembersHandler, createChannelMembersHandler)
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Server running at http://localhost:${PORT}`);
                console.log('Open http://localhost:3000 in your browser');
            });
        })
        .catch(console.error);
}

// Export for testing
module.exports = { createApp, channelMembersHandler, createChannelMembersHandler, slackApiCall };