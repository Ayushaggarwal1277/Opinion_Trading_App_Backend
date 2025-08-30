# 🎯 Threshold-Based Auto-Settlement Feature

## Overview
Markets now automatically settle when the YES price reaches the threshold value, providing instant settlement without waiting for expiry time.

## 🚀 How It Works

### Two Settlement Mechanisms:
1. **⚡ Threshold Settlement** (New): Immediate when YES price ≥ threshold
2. **⏰ Time Settlement** (Existing): At expiry using real-world temperature data

### Real-Time Monitoring:
- Checked after every trade execution
- Monitored every minute by scheduler
- Can be manually triggered via API

## 📊 Settlement Logic

### Threshold Settlement:
```
IF market.yesPrice >= market.threshold:
    - Mark market as "expired"
    - Set result = "YES" (automatic win)
    - Settle executed trades (winners get ₹9/share)
    - Refund pending trades
    - Emit auto-settlement notifications
```

### Time Settlement (Fallback):
```
IF market.expiry <= now AND threshold not reached:
    - Fetch real temperature data
    - Set result = temp >= threshold ? "YES" : "NO"
    - Settle all trades based on actual outcome
```

## 🔔 Enhanced Notifications

### WebSocket Events Updated:

#### `marketExpired` (Enhanced):
```javascript
{
    question: "Will temp exceed 25°C?",
    expiry: "2025-08-31T12:00:00Z",
    reason: "YES price (₹25.5) reached threshold (₹25)",
    autoSettled: true,
    thresholdTriggered: true,
    immediate: true // for instant triggers
}
```

#### `marketSettled` (Enhanced):
```javascript
{
    result: "YES",
    question: "Will temp exceed 25°C?",
    settlementType: "threshold", // or "time_based"
    reason: "YES price reached ₹25 (threshold: ₹25)",
    yesPrice: 25.5,
    threshold: 25
}
```

## 📡 New API Endpoints

### GET `/markets/:id/status`
Enhanced market status with threshold analysis:

```json
{
    "success": true,
    "market": {
        "_id": "market_id",
        "question": "Will temp exceed 25°C?",
        "yesPrice": 23.5,
        "noPrice": 6.5,
        "threshold": 25,
        "status": "active"
    },
    "thresholdAnalysis": {
        "distanceToThreshold": 1.5,
        "percentageOfThreshold": 94.0,
        "willAutoSettle": false,
        "timeToExpiry": 2,
        "status": "ACTIVE"
    }
}
```

### POST `/markets/:id/check-threshold`
Manual threshold check (admin only):

```json
{
    "success": true,
    "message": "Threshold not reached",
    "thresholdTriggered": false,
    "currentPrice": 23.5,
    "threshold": 25
}
```

## 🎮 Testing Scenarios

### Scenario A: Normal Trading
```bash
# Create market with threshold ₹25
# Place trades: YES ₹20, NO ₹8
# Result: Market stays active (below threshold)
```

### Scenario B: Threshold Trigger
```bash
# Continuing from Scenario A...
# Place trade: YES ₹25 or higher
# Result: INSTANT auto-settlement! YES wins automatically
```

### Scenario C: Time-Based Settlement
```bash
# Market expires without reaching threshold
# System checks real temperature vs threshold
# Settlement based on actual weather data
```

## 💻 Frontend Integration

### Display Threshold Proximity:
```javascript
// Use enhanced status endpoint
const response = await fetch(`/markets/${marketId}/status`);
const { thresholdAnalysis } = await response.json();

// Show user proximity to auto-settlement
if (thresholdAnalysis.percentageOfThreshold > 90) {
    showWarning(`Market will auto-settle at ₹${market.threshold}!`);
}
```

### Listen for Auto-Settlement:
```javascript
socket.on('marketExpired', (data) => {
    if (data.thresholdTriggered) {
        showNotification('Market auto-settled due to threshold!');
    }
});
```

## 🔧 Configuration

### Market Creation:
```javascript
const market = {
    question: "Will Delhi temp exceed 25°C tomorrow?",
    threshold: 25, // Auto-settle when YES price reaches ₹25
    expiry: "2025-08-31T18:00:00Z"
};
```

### Environment Variables:
No additional env vars needed - uses existing MongoDB and WebSocket setup.

## 📈 Benefits

1. **Instant Liquidity**: No waiting for expiry when outcome is certain
2. **Risk Management**: Platform can limit exposure automatically
3. **User Experience**: Immediate settlement when market confidence is high
4. **Efficiency**: Reduces unnecessary pending trades

## 🚨 Important Notes

- Threshold settlements always result in YES winning
- Pending trades get refunded (not settled) during threshold triggers
- Original time-based settlement remains as fallback
- All existing API endpoints continue to work unchanged

## 🔄 Migration

This feature is backward compatible:
- Existing markets continue normal time-based settlement
- New markets can use threshold-based auto-settlement
- No breaking changes to existing functionality

---

**Ready to use!** Create markets with threshold values and watch them auto-settle when YES price reaches the target! 🎯
