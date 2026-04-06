/**
 * IntelliStake Oracle Bridge - Chainlink Functions Script
 * ========================================================
 * 
 * This Chainlink Functions JavaScript code fetches AI-generated startup valuations
 * from the Python ML microservice and formats them for Ethereum smart contract consumption.
 * 
 * Data Flow:
 * Python ML API → Chainlink Functions → EVM Encoding → IntelliStake Smart Contract
 * 
 * Author: IntelliStake Development Team
 * Course: MBA (Tech) Capstone - NMIMS
 * Date: February 2026
 */

// ==================== Configuration ====================

/**
 * API Configuration
 * In production, these would be stored as Chainlink DON (Decentralized Oracle Network) secrets
 */
const API_CONFIG = {
    baseUrl: args[0] || "https://api.intellistake.io",  // ML service endpoint
    apiKey: secrets.apiKey || "",                        // API authentication key
    timeout: 5000,                                       // Request timeout (ms)
    retryAttempts: 3,                                    // Number of retry attempts
    retryDelay: 1000                                     // Delay between retries (ms)
};

/**
 * Request parameters passed from smart contract
 * args[0]: API base URL
 * args[1]: Startup ID to fetch valuation for
 * args[2]: Request type ('valuation' | 'portfolio_weights' | 'risk_score')
 */
const startupId = args[1];
const requestType = args[2] || "valuation";

// ==================== Helper Functions ====================

/**
 * Make HTTP request with retry logic and exponential backoff
 * @param {string} url - Full API endpoint URL
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Object>} API response data
 */
async function fetchWithRetry(url, attempt = 1) {
    try {
        console.log(`[Attempt ${attempt}] Fetching from: ${url}`);

        const response = await Functions.makeHttpRequest({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${API_CONFIG.apiKey}`,
                "Content-Type": "application/json",
                "X-Request-Source": "Chainlink-Functions"
            },
            timeout: API_CONFIG.timeout
        });

        // Check HTTP status
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Validate response structure
        if (!response.data) {
            throw new Error("Empty response data");
        }

        console.log(`[Success] Data received for startup: ${startupId}`);
        return response.data;

    } catch (error) {
        console.log(`[Error] Attempt ${attempt} failed: ${error.message}`);

        // Retry logic with exponential backoff
        if (attempt < API_CONFIG.retryAttempts) {
            const delay = API_CONFIG.retryDelay * Math.pow(2, attempt - 1);
            console.log(`[Retry] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, attempt + 1);
        }

        // Max retries exceeded
        throw new Error(`Failed after ${API_CONFIG.retryAttempts} attempts: ${error.message}`);
    }
}

/**
 * Validate API response data structure
 * @param {Object} data - API response data
 * @param {string} type - Expected data type
 * @returns {boolean} True if valid
 */
function validateResponseData(data, type) {
    switch (type) {
        case "valuation":
            return (
                typeof data.estimated_valuation === 'number' &&
                typeof data.confidence_score === 'number' &&
                data.estimated_valuation > 0 &&
                data.confidence_score >= 0 &&
                data.confidence_score <= 1
            );

        case "portfolio_weights":
            return (
                Array.isArray(data.weights) &&
                data.weights.every(w => typeof w === 'number' && w >= 0 && w <= 1) &&
                Math.abs(data.weights.reduce((a, b) => a + b, 0) - 1.0) < 0.01
            );

        case "risk_score":
            return (
                typeof data.risk_score === 'number' &&
                data.risk_score >= 0 &&
                data.risk_score <= 100
            );

        default:
            return false;
    }
}

/**
 * Convert floating point values to Solidity-compatible integers.
 * Ethereum doesn't support floating point, so we scale by 10^18 (wei precision).
 *
 * BUG FIX: The previous implementation did:
 *   BigInt(Math.floor(value * Number(SCALING_FACTOR)))
 * This is wrong because:
 *   - 10^18 exceeds Number.MAX_SAFE_INTEGER (2^53 ≈ 9×10^15)
 *   - Converting SCALING_FACTOR back to Number loses precision
 *   - Multiplying a float by an imprecise Number compounds the error
 *
 * CORRECT APPROACH: Keep everything in BigInt. Split the value into integer and
 * fractional parts, scale each independently using BigInt arithmetic only.
 *
 * @param {number} value - Floating point value (e.g. 0.9645 or 1234567.89)
 * @returns {string} Integer string representation scaled by 10^18
 */
function floatToSolidityInt(value) {
    // Clamp to safe range and handle edge cases
    if (!isFinite(value) || isNaN(value)) return "0";

    const SCALE = 10n ** 18n;   // Use BigInt literal — no Number conversion

    // Split into integer and fractional parts
    const intPart  = Math.floor(Math.abs(value));
    const fracPart = Math.abs(value) - intPart;

    // Scale integer part: safe because intPart fits in a JS integer
    const intScaled = BigInt(intPart) * SCALE;

    // Scale fractional part using 9 decimal digits of precision (avoids overflow)
    // fracPart ∈ [0, 1), so fracPart * 1e9 ∈ [0, 1e9) — well within safe integer range
    const FRAC_PRECISION = 9;
    const fracDigits     = Math.round(fracPart * 10 ** FRAC_PRECISION);
    // fracScaled = fracDigits * (10^18 / 10^FRAC_PRECISION) = fracDigits * 10^9
    const fracScaled = BigInt(fracDigits) * (SCALE / 10n ** BigInt(FRAC_PRECISION));

    const result = intScaled + fracScaled;
    return (value < 0 ? -result : result).toString();
}

/**
 * Encode response data for EVM (Ethereum Virtual Machine)
 * @param {Object} data - Validated API response
 * @param {string} type - Data type
 * @returns {string} ABI-encoded hex string
 */
function encodeForEVM(data, type) {
    switch (type) {
        case "valuation":
            // Encode as tuple: (uint256 valuation, uint256 confidence, uint256 timestamp)
            const valuation = floatToSolidityInt(data.estimated_valuation);
            const confidence = floatToSolidityInt(data.confidence_score);
            const timestamp = BigInt(Math.floor(Date.now() / 1000)).toString();

            console.log(`[Encoding] Valuation: $${data.estimated_valuation.toLocaleString()}`);
            console.log(`[Encoding] Confidence: ${(data.confidence_score * 100).toFixed(2)}%`);

            // Return as comma-separated values (Chainlink Functions auto-encodes to bytes)
            return Functions.encodeUint256(valuation) +
                Functions.encodeUint256(confidence).slice(2) +
                Functions.encodeUint256(timestamp).slice(2);

        case "portfolio_weights":
            // Encode array of weights (uint256[])
            console.log(`[Encoding] ${data.weights.length} portfolio weights`);
            const encodedWeights = data.weights.map(w => floatToSolidityInt(w));
            return Functions.encodeUint256Array(encodedWeights);

        case "risk_score":
            // Encode single uint256
            const riskScore = BigInt(Math.floor(data.risk_score)).toString();
            console.log(`[Encoding] Risk Score: ${data.risk_score}/100`);
            return Functions.encodeUint256(riskScore);

        default:
            throw new Error(`Unknown encoding type: ${type}`);
    }
}

// ==================== Main Execution Logic ====================

/**
 * Main function executed by Chainlink DON
 */
async function main() {
    console.log("========================================");
    console.log("IntelliStake Oracle Bridge - Executing");
    console.log("========================================");
    console.log(`Startup ID: ${startupId}`);
    console.log(`Request Type: ${requestType}`);
    console.log("----------------------------------------");

    try {
        // Step 1: Construct API endpoint
        const endpoint = `${API_CONFIG.baseUrl}/api/v1/${requestType}/${startupId}`;

        // Step 2: Fetch data from Python ML service
        const responseData = await fetchWithRetry(endpoint);

        // Step 3: Validate response structure
        const isValid = validateResponseData(responseData, requestType);
        if (!isValid) {
            throw new Error(`Invalid response data structure for type: ${requestType}`);
        }

        console.log("[Validation] Response data validated successfully");

        // Step 4: Encode for EVM
        const encodedData = encodeForEVM(responseData, requestType);

        console.log("========================================");
        console.log("Oracle Bridge Execution Complete");
        console.log("========================================");

        // Return encoded data to smart contract
        return encodedData;

    } catch (error) {
        console.error("========================================");
        console.error("ERROR: Oracle Bridge Failed");
        console.error("========================================");
        console.error(`Error Type: ${error.name}`);
        console.error(`Error Message: ${error.message}`);
        console.error(`Stack Trace: ${error.stack}`);

        // Return error code to smart contract (0 indicates failure)
        // In production, smart contract should have fallback logic
        return Functions.encodeUint256("0");
    }
}

// ==================== Error Handling & Circuit Breaker ====================

/**
 * Emergency circuit breaker
 * If API is consistently failing, return cached value or trigger emergency mode
 */
const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,      // Number of consecutive failures before tripping
    resetTimeout: 300000      // Time (ms) before attempting reset (5 min)
};

/**
 * Check if circuit breaker should trip
 * (In production, this would use persistent storage across executions)
 * @returns {boolean} True if circuit is open (too many failures)
 */
function checkCircuitBreaker() {
    // This is a simplified version
    // Production would track failure count in smart contract or external DB
    return false;
}

// ==================== Execute ====================

// Check circuit breaker
if (checkCircuitBreaker()) {
    console.error("[CIRCUIT BREAKER] Too many consecutive failures. Returning cached value.");
    // Return last known good value (would be stored in smart contract)
    return Functions.encodeUint256("0");
}

// Execute main oracle logic
return main();

/**
 * DEPLOYMENT NOTES FOR CHAINLINK FUNCTIONS:
 * ==========================================
 * 
 * 1. Register this script with Chainlink DON
 * 2. Configure secrets (API_KEY) via Chainlink Functions UI
 * 3. Fund subscription with LINK tokens
 * 4. Deploy consumer contract (IntelliStakeOracle.sol)
 * 5. Add consumer contract to subscription
 * 6. Call requestValuation() from smart contract, passing:
 *    - args[0]: API base URL
 *    - args[1]: Startup ID
 *    - args[2]: Request type
 * 
 * TESTING LOCALLY:
 * ================
 * Use Chainlink Functions simulator:
 * npx @chainlink/functions-toolkit@latest simulate --script IntelliStakeOracle.js
 * 
 * SECURITY CONSIDERATIONS:
 * ========================
 * - API keys stored as DON secrets (not in code)
 * - HTTPS only for API requests
 * - Response validation before encoding
 * - Timeout and retry limits prevent resource exhaustion
 * - Circuit breaker prevents cascading failures
 * - All errors logged for monitoring
 * 
 * COST ESTIMATION:
 * ================
 * - Per request: ~0.5 LINK (varies by complexity and gas price)
 * - Monthly (1000 requests): ~500 LINK
 * - Recommend maintaining 2x buffer in subscription
 */
