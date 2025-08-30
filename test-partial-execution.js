// Test script for partial execution feature
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Mock user credentials (you'll need to register users first)
const testUsers = [
    { email: 'user1@test.com', password: 'password123' },
    { email: 'user2@test.com', password: 'password123' },
    { email: 'user3@test.com', password: 'password123' }
];

async function registerUser(email, password, name) {
    try {
        const response = await axios.post(`${BASE_URL}/user/register`, {
            email,
            password,
            name
        });
        console.log(`✅ User ${email} registered successfully`);
        return response.data;
    } catch (error) {
        if (error.response?.data?.message?.includes('already exists')) {
            console.log(`ℹ️ User ${email} already exists`);
            return null;
        }
        console.error(`❌ Failed to register user ${email}:`, error.response?.data?.message);
        return null;
    }
}

async function loginUser(email, password) {
    try {
        const response = await axios.post(`${BASE_URL}/user/login`, {
            email,
            password
        });
        console.log(`✅ User ${email} logged in successfully`);
        return response.data.token;
    } catch (error) {
        console.error(`❌ Failed to login user ${email}:`, error.response?.data?.message);
        return null;
    }
}

async function createMarket(token, title, description) {
    try {
        const response = await axios.post(`${BASE_URL}/market/create`, {
            title,
            description,
            expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Market created: ${title}`);
        return response.data.market._id;
    } catch (error) {
        console.error(`❌ Failed to create market:`, error.response?.data?.message);
        return null;
    }
}

async function placeTrade(token, marketId, option, amount, price) {
    try {
        const response = await axios.post(`${BASE_URL}/market/${marketId}/trade`, {
            option,
            side: 'buy',
            amount,
            price
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Trade placed: ${amount} ${option.toUpperCase()} shares at ₹${price}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Failed to place trade:`, error.response?.data?.message);
        return null;
    }
}

async function getMarketDetails(marketId) {
    try {
        const response = await axios.get(`${BASE_URL}/market/${marketId}`);
        return response.data.market;
    } catch (error) {
        console.error(`❌ Failed to get market details:`, error.response?.data?.message);
        return null;
    }
}

async function testPartialExecution() {
    console.log('\n🚀 Starting Partial Execution Test\n');

    // Step 1: Register test users
    console.log('📝 Step 1: Setting up test users...');
    await registerUser('user1@test.com', 'password123', 'Test User 1');
    await registerUser('user2@test.com', 'password123', 'Test User 2');
    await registerUser('user3@test.com', 'password123', 'Test User 3');

    // Step 2: Login users
    console.log('\n🔐 Step 2: Logging in users...');
    const token1 = await loginUser('user1@test.com', 'password123');
    const token2 = await loginUser('user2@test.com', 'password123');
    const token3 = await loginUser('user3@test.com', 'password123');

    if (!token1 || !token2 || !token3) {
        console.error('❌ Failed to login all users');
        return;
    }

    // Step 3: Create a test market
    console.log('\n🏪 Step 3: Creating test market...');
    const marketId = await createMarket(token1, 'Partial Execution Test Market', 'Testing partial execution feature');
    if (!marketId) {
        console.error('❌ Failed to create market');
        return;
    }

    // Step 4: Place the large trade (4 YES shares at ₹2)
    console.log('\n📊 Step 4: Placing large YES trade...');
    await placeTrade(token1, marketId, 'yes', 4, 2);

    // Check market state
    let market = await getMarketDetails(marketId);
    console.log(`Market state: YES: ₹${market.yesPrice}, NO: ₹${market.noPrice}`);

    // Step 5: Place smaller opposite trade (1 NO share at ₹8)
    console.log('\n📊 Step 5: Placing smaller NO trade (should trigger partial execution)...');
    await placeTrade(token2, marketId, 'no', 1, 8);

    // Check market state after partial execution
    market = await getMarketDetails(marketId);
    console.log(`Market state after partial execution: YES: ₹${market.yesPrice}, NO: ₹${market.noPrice}`);

    // Step 6: Place another NO trade to test further partial execution
    console.log('\n📊 Step 6: Placing another NO trade...');
    await placeTrade(token3, marketId, 'no', 2, 8);

    // Final market state
    market = await getMarketDetails(marketId);
    console.log(`Final market state: YES: ₹${market.yesPrice}, NO: ₹${market.noPrice}`);

    console.log('\n✅ Partial execution test completed! Check the console logs for execution details.');
}

// Run the test
testPartialExecution().catch(console.error);
