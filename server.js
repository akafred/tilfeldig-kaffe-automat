const express = require('express');
const https = require('https');
const path = require('path');

const PORT = process.argv[2] || 3000;
const REQUEST_TIMEOUT_MS = 30000;
const USER_LOOKUP_CONCURRENCY = 5;
const MAX_SLACK_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

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
        
        const request = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    json.statusCode = res.statusCode;
                    json.headers = res.headers;
                    resolve(json);
                } catch (error) {
                    const responseError = new Error('Invalid JSON response');
                    responseError.statusCode = res.statusCode;
                    responseError.headers = res.headers;
                    reject(responseError);
                }
            });
        }).on('error', reject);
        request.setTimeout(REQUEST_TIMEOUT_MS, () => {
            const timeoutError = new Error('Slack API request timed out');
            timeoutError.code = 'ETIMEDOUT';
            request.destroy(timeoutError);
        });
    });
}

function isRateLimited(responseOrError) {
    return responseOrError?.statusCode === 429 ||
        responseOrError?.error === 'ratelimited' ||
        responseOrError?.code === 'ETIMEDOUT';
}

function getRetryDelayMs(responseOrError, attempt, baseDelayMs) {
    const retryAfter = responseOrError?.retryAfter ??
        responseOrError?.headers?.['retry-after'];
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
        return retryAfterSeconds * 1000;
    }
    return baseDelayMs * (2 ** attempt);
}

function sleep(delayMs) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function callSlackWithRetry(apiCallFn, endpoint, token, params, options = {}) {
    const maxRetries = options.maxRetries ?? MAX_SLACK_RETRIES;
    const baseDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const sleepFn = options.sleepFn ?? sleep;

    for (let attempt = 0; ; attempt++) {
        try {
            const response = await apiCallFn(endpoint, token, params);
            if (!isRateLimited(response) || attempt >= maxRetries) {
                return response;
            }
            await sleepFn(getRetryDelayMs(response, attempt, baseDelayMs));
        } catch (error) {
            if (!isRateLimited(error) || attempt >= maxRetries) {
                throw error;
            }
            await sleepFn(getRetryDelayMs(error, attempt, baseDelayMs));
        }
    }
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    let firstError = null;

    async function worker() {
        while (!firstError) {
            const index = nextIndex++;
            if (index >= items.length) return;

            try {
                results[index] = await mapper(items[index]);
            } catch (error) {
                firstError = error;
            }
        }
    }

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    if (firstError) throw firstError;
    return results;
}

function createChannelMembersHandler(apiCallFn = slackApiCall, options = {}) {
    return async function channelMembersHandler(req, res) {
        try {
            const body = req.body || {};
            const { token, channelId } = body;
            
            if (!token || !channelId) {
                return res.status(400).json({ error: 'Token and channelId are required' });
            }

            let allMembers = [];
            let cursor = '';
            
            do {
                const params = { channel: channelId, limit: 1000 };
                if (cursor) params.cursor = cursor;
                
                const data = await callSlackWithRetry(
                    apiCallFn,
                    'conversations.members',
                    token,
                    params,
                    options,
                );
                
                if (!data.ok) {
                    return res.status(400).json({ error: data.error });
                }
                
                allMembers = allMembers.concat(data.members);
                cursor = data.response_metadata?.next_cursor || '';
            } while (cursor);

            const users = await mapWithConcurrency(
                allMembers,
                USER_LOOKUP_CONCURRENCY,
                async (userId) => {
                    const userData = await callSlackWithRetry(
                        apiCallFn,
                        'users.info',
                        token,
                        { user: userId },
                        options,
                    );
                    if (!userData.ok) {
                        const error = new Error(
                            `Slack users.info failed: ${userData.error || 'unknown_error'}`,
                        );
                        error.statusCode = 502;
                        throw error;
                    }
                    return userData.user;
                },
            );

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
            const statusCode = error.statusCode >= 400 ? error.statusCode : 500;
            res.status(statusCode).json({ error: error.message });
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
                console.log(`Open http://localhost:${PORT} in your browser`);
            });
        })
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
}

// Export for testing
module.exports = {
    createApp,
    channelMembersHandler,
    createChannelMembersHandler,
    slackApiCall,
    mapWithConcurrency,
    callSlackWithRetry,
};