# Debug Guide: Question Selection Not Working

## Current Status
Question selection is not working. Let's debug step by step.

## Debugging Steps

### 1. Check Browser Console
When you try to select a question, check the browser console for:

**Expected logs:**
```
=== QUESTION SELECTION TRIGGERED ===
Question ID: [some-id]
Selective answering enabled: true
Current selectedQuestions state: {...}
🚀 Sending selection request to server...
Request details: {...}
✅ Selection update response: {...}
✅ Question selection updated successfully
```

**If you see:**
- `❌ Selective answering is not enabled` → The exam doesn't have selective answering enabled
- `❌ Exam data not available` → The exam data hasn't loaded properly
- `❌ Error updating question selection` → Server request failed

### 2. Check Server Console
When the request hits the server, you should see:

**Expected logs:**
```
=== SELECT QUESTION ENDPOINT CALLED ===
Request params: { id: 'exam-id' }
Request body: { questionId: 'question-id', isSelected: true/false }
User: user-id
✅ Input validation passed: { questionId: '...', isSelected: true }
🔍 Looking for exam result: {...}
✅ Found exam result: {...}
```

**If you see:**
- `❌ Question ID is missing` → Frontend not sending questionId
- `❌ isSelected is not a boolean` → Frontend sending wrong data type
- `❌ Exam session not found` → No active exam session for this user

### 3. Common Issues and Solutions

#### Issue 1: Selective Answering Not Enabled
**Symptoms:** Message "Selective answering is not enabled"
**Solution:** 
1. Go to admin dashboard
2. Edit the exam
3. Enable "Allow Selective Answering"
4. Set required questions for sections B and C

#### Issue 2: No Active Exam Session
**Symptoms:** "Exam session not found or already completed"
**Solution:**
1. Make sure you started the exam properly
2. Check if exam was accidentally completed
3. Restart the exam if needed

#### Issue 3: Authentication Issues
**Symptoms:** 401 Unauthorized errors
**Solution:**
1. Check if user is logged in
2. Verify JWT token is valid
3. Check if user has student role

#### Issue 4: Frontend State Issues
**Symptoms:** Selection UI not responding
**Solution:**
1. Check if `selectedQuestions` state is initialized
2. Verify `handleQuestionSelection` is called
3. Check if question IDs match between frontend and backend

### 4. Manual Testing Steps

1. **Create Test Exam:**
   - Enable selective answering
   - Set Section B: 3 required questions
   - Set Section C: 1 required question
   - Upload exam with multiple questions in each section

2. **Start Exam as Student:**
   - Login as student
   - Start the exam
   - Check if selective answering banner appears

3. **Test Selection Methods:**
   - Try Shift+click on question numbers
   - Try right-click on question numbers
   - Try clicking selection chip above questions

4. **Verify Selection State:**
   - Check browser console for state updates
   - Verify visual feedback (icons, colors)
   - Refresh page and check if selection persists

### 5. Quick Fixes to Try

#### Fix 1: Clear Browser Cache
```bash
# Clear browser cache and localStorage
localStorage.clear();
location.reload();
```

#### Fix 2: Restart Exam Session
```bash
# In browser console
localStorage.removeItem('examSession');
# Then restart the exam
```

#### Fix 3: Check API Base URL
```javascript
// In browser console
console.log('API Base URL:', import.meta.env.VITE_API_URL);
```

### 6. Expected Behavior

When working correctly:
1. **Visual Feedback:** Selected questions show green checkmark, unselected show empty circle
2. **Selection Limits:** Can't deselect below minimum required questions
3. **Persistence:** Selection state saves and restores on page refresh
4. **Success Messages:** Clear feedback when selection changes
5. **Error Handling:** Helpful error messages when operations fail

### 7. Debug Commands

Run these in browser console to check state:

```javascript
// Check current selection state
console.log('Selected Questions:', selectedQuestions);

// Check exam data
console.log('Exam Data:', exam);

// Check if selective answering is enabled
console.log('Selective Answering:', selectiveAnswering);

// Test manual selection
handleQuestionSelection('some-question-id');
```

## Next Steps

1. Follow the debugging steps above
2. Check both browser and server console logs
3. Identify which step is failing
4. Apply the appropriate fix
5. Test the functionality thoroughly

If the issue persists, provide the specific error messages and console logs for further assistance.
