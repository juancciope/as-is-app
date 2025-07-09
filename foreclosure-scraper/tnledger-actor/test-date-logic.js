// Test script to verify the date logic works correctly

const getTargetFridayDate = (testDate) => {
    const today = testDate || new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    let targetDate;
    
    if (dayOfWeek === 5) {
        // If today is Friday, use today's date
        targetDate = new Date(today);
    } else if (dayOfWeek === 6) {
        // If today is Saturday, use yesterday (Friday)
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 1);
    } else {
        // For Sunday through Thursday, use the most recent Friday
        const daysToSubtract = dayOfWeek === 0 ? 2 : dayOfWeek + 2;
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() - daysToSubtract);
    }
    
    // Format as M/D/YYYY (e.g., "7/4/2025")
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const year = targetDate.getFullYear();
    
    return `${month}/${day}/${year}`;
};

// Test scenarios
const testCases = [
    // [Date, Day of week, Expected behavior]
    [new Date(2025, 6, 11), 'Friday', 'Should use today (7/11/2025)'],
    [new Date(2025, 6, 12), 'Saturday', 'Should use yesterday (7/11/2025)'],
    [new Date(2025, 6, 13), 'Sunday', 'Should use most recent Friday (7/11/2025)'],
    [new Date(2025, 6, 14), 'Monday', 'Should use most recent Friday (7/11/2025)'],
    [new Date(2025, 6, 15), 'Tuesday', 'Should use most recent Friday (7/11/2025)'],
    [new Date(2025, 6, 16), 'Wednesday', 'Should use most recent Friday (7/11/2025)'],
    [new Date(2025, 6, 17), 'Thursday', 'Should use most recent Friday (7/11/2025)'],
    [new Date(2025, 6, 18), 'Friday', 'Should use today (7/18/2025)'],
];

console.log('Testing TN Ledger date logic:');
console.log('============================');

testCases.forEach(([testDate, dayName, expected]) => {
    const result = getTargetFridayDate(testDate);
    console.log(`${dayName} (${testDate.toDateString()}): ${result} - ${expected}`);
});

console.log('\\nCurrent date test:');
console.log('==================');
const currentResult = getTargetFridayDate();
console.log(`Today: ${currentResult}`);