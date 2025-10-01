# app.py

# New imports for environment variables and Gemini API
import os
import re
import html
from dotenv import load_dotenv
import google.generativeai as genai

from flask import Flask, request, jsonify, render_template

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini API with your API key
# genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
# Using getenv for clarity and consistency
genai.configure(api_key=os.getenv("GEMINI_API_KEY")) # os.getenv is safer, returns None if not found

# Initialize the Generative Model (using the model that worked with curl)
# Set temperature to 0.0 for less creative, more direct answers based on instructions
model = genai.GenerativeModel(
    'gemini-2.0-flash', # Using the model that worked for you
    generation_config={
        "temperature": 0.0, # Make the AI less creative and more focused on following instructions
        # "max_output_tokens": 150, # Optional: you can add this to limit response length
    }
)

app = Flask(__name__)

# --- Security Functions ---
def sanitize_input(text):
    """Sanitize user input to prevent prompt injection"""
    if not text:
        return ""

    # Decode HTML entities
    text = html.unescape(text)

    # Remove or escape dangerous patterns that could be used for prompt injection
    dangerous_patterns = [
        r'ignore previous instructions',
        r'ignore above',
        r'ignore all previous',
        r'forget everything',
        r'new instructions',
        r'act as',
        r'pretend to be',
        r'you are now',
        r'system prompt',
        r'ignore the above',
        r'disregard previous',
        r'ignore all above',
        r'new system',
        r'override',
        r'bypass',
        r'ignore safety',
        r'ignore content policy',
        r'ignore guidelines',
        r'ignore rules',
        r'ignore restrictions',
        r'you must',
        r'you should',
        r'you will',
        r'change your role',
        r'stop being',
        r'become',
        r'now you are',
        r'from now on',
        r'starting now',
        r'forget your',
        r'disregard your',
        r'ignore your'
    ]

    for pattern in dangerous_patterns:
        text = re.sub(pattern, '[REDACTED]', text, flags=re.IGNORECASE)

    # Remove any remaining control characters
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)

    # Limit length to prevent token flooding
    if len(text) > 2000:
        text = text[:2000] + "..."

    return text.strip()

def validate_problem_name(problem_name):
    """Validate problem name format"""
    if not problem_name:
        return False, "Problem name cannot be empty"

    # Allow alphanumeric, spaces, hyphens, and common punctuation
    if not re.match(r'^[a-zA-Z0-9\s\-_.,()#]+$', problem_name):
        return False, "Invalid problem name format"

    # Length limits
    if len(problem_name) > 100:
        return False, "Problem name too long"

    return True, problem_name

def sanitize_conversation_history(history):
    """Sanitize conversation history to prevent injection"""
    if not history:
        return []

    sanitized_history = []
    for interaction in history[:10]:  # Limit to last 10 interactions
        if isinstance(interaction, dict):
            safe_user_input = sanitize_input(interaction.get('userInput', ''))
            safe_bot_response = sanitize_input(interaction.get('botResponse', ''))

            if safe_user_input and safe_bot_response:
                sanitized_history.append({
                    'userInput': safe_user_input,
                    'botResponse': safe_bot_response
                })

    return sanitized_history

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/app')
def index():
    return render_template('index.html')

@app.route('/conversation', methods=['POST'])
def conversation():
    """Handle ongoing conversation messages"""
    data = request.json

    if not data or 'message' not in data:
        return jsonify({'error': 'Message not provided'}), 400

    # Sanitize and validate all inputs
    raw_message = data['message']
    raw_problem_name = data.get('problemName', '')
    raw_conversation_history = data.get('conversationHistory', [])

    # Validate and sanitize inputs
    if not raw_problem_name:
        return jsonify({'error': 'Problem name not provided'}), 400

    is_valid, problem_result = validate_problem_name(raw_problem_name)
    if not is_valid:
        return jsonify({'error': problem_result}), 400

    # Sanitize inputs
    message = sanitize_input(raw_message)
    problem_name = sanitize_input(raw_problem_name)
    conversation_history = sanitize_conversation_history(raw_conversation_history)

    print(f"Conversation message for problem: {problem_name[:50]}...")
    print(f"User message: {message[:100]}...")
    if conversation_history:
        print(f"With {len(conversation_history)} previous interactions")

    # Build conversation context
    conversation_context = "Previous conversation:\n"
    for i, interaction in enumerate(conversation_history, 1):
        user_part = interaction.get('userInput', '')
        bot_part = interaction.get('botResponse', '')
        conversation_context += f"Exchange {i}:\n"
        conversation_context += f"User: {user_part}\n"
        conversation_context += f"Coach: {bot_part}\n\n"

    # System prompt for ongoing conversation
    system_prompt = """You are a friendly and encouraging LeetCode Coach bot engaged in an ongoing conversation with a student about a specific problem.

The student is asking a follow-up question or sharing additional information about their approach. Continue the coaching conversation naturally.

Guidelines:
1. **Be Conversational**: Respond naturally as if you're having a real conversation with a student who is learning.
2. **Stay Encouraging**: Maintain a supportive and encouraging tone throughout the conversation.
3. **Build on Previous Context**: Reference previous parts of the conversation when relevant.
4. **Ask Clarifying Questions**: Feel free to ask questions to better understand their approach or thinking.
5. **Guide, Don't Solve**: Provide guidance and hints rather than direct solutions.
6. **Be Adaptive**: Adjust your response based on whether they seem to be making progress or are still stuck.

Current Problem: [PROBLEM_NAME]
[CONVERSATION_CONTEXT]
Student's Latest Message: [USER_MESSAGE]

Respond as the Coach in this ongoing conversation:"""

    # Replace placeholders with sanitized values
    prompt_text = system_prompt.replace("[PROBLEM_NAME]", problem_name)
    prompt_text = prompt_text.replace("[CONVERSATION_CONTEXT]", conversation_context)
    prompt_text = prompt_text.replace("[USER_MESSAGE]", message)

    # Interact with Gemini API
    try:
        response_gemini = model.generate_content(prompt_text)
        ai_full_response = response_gemini.text
        print(f"Gemini conversation response:\n{ai_full_response}")

        # For conversation responses, we just return the response as-is
        response_text = ai_full_response.strip()

    except Exception as e:
        print(f"Error calling Gemini API for conversation: {e}")
        response_text = "I'm sorry, I encountered an error. Could you please try asking your question again?"

    # Prepare the response
    response_for_frontend = {
        'response': response_text
    }

    return jsonify(response_for_frontend)

@app.route('/get_hint', methods=['POST'])
def get_hint():
    data = request.json

    if not data or 'problemName' not in data:
        return jsonify({'error': 'Problem name not provided'}), 400

    # Sanitize and validate all inputs
    raw_problem_name = data['problemName']
    raw_context = data.get('context', '').strip()
    raw_conversation_history = data.get('conversationHistory', [])
    request_type = data.get('requestType', 'first_hint')

    # Validate problem name
    is_valid, problem_result = validate_problem_name(raw_problem_name)
    if not is_valid:
        return jsonify({'error': problem_result}), 400

    # Sanitize inputs
    problem_name = sanitize_input(raw_problem_name)
    context = sanitize_input(raw_context)
    conversation_history = sanitize_conversation_history(raw_conversation_history)

    print(f"Received request for problem: {problem_name[:50]}...")
    print(f"Request type: {request_type}")
    if context:
        print(f"With context: {context[:100]}...")
    if conversation_history:
        print(f"With {len(conversation_history)} previous hints")

    # --- AI Prompt Definition (Secure Approach) ---
    # Use structured approach to prevent direct user input injection

    if request_type == 'first_hint':
        # Base system prompt without user input
        system_prompt = """You are a friendly and encouraging LeetCode Coach bot. Your goal is to help users learn problem-solving patterns through guided conversation, just like a patient tutor would.

Your response style should be:
- **Conversational and encouraging**: Talk like a supportive coach, not a formal assistant
- **Questioning**: Often ask clarifying questions to understand their thinking
- **Gradual guidance**: Give hints that guide their thinking rather than solutions

Here are your instructions for *each problem query*:
1. **Acknowledge their situation**: Show understanding if they mention being stuck
2. **Evaluate their approach (if provided)**: If they share context about their current approach, briefly evaluate whether they're on the right track. Be encouraging but honest.
3. **Provide a guiding hint**: Give a single, conceptual hint that guides their thinking process.
   - Ask probing questions like "What data structure helps you remember things?" instead of "Use a hash map"
   - Guide them to discover patterns: "What happens when you see the same number twice?"
   - Encourage experimentation: "What would happen if you tried...?"
4. **End with an engaging question**: Ask them something to continue the conversation and check their understanding

Keep your response conversational and under 3-4 sentences. Think of it as the opening of a tutoring session.

If you do not recognize the problem name or number provided by the user, respond with: "I'm not familiar with that problem. Could you please check the spelling or problem number and try again?"

PROBLEM TO ANALYZE: [PROBLEM_NAME]
USER CONTEXT: [USER_CONTEXT]"""

        # Replace placeholders with sanitized values
        prompt_text = system_prompt.replace("[PROBLEM_NAME]", problem_name)
        prompt_text = prompt_text.replace("[USER_CONTEXT]", context if context else "No additional context provided")

    else:  # another_hint
        # Base system prompt for additional hints
        system_prompt = """You are a friendly and encouraging LeetCode Coach bot. The user has already received some guidance for this problem and is asking for a different perspective or approach.

Continue the coaching conversation naturally:
- **Acknowledge their progress**: "Interesting! Let me give you a different angle..."
- **Provide a genuinely different approach**: Make sure your hint explores a completely different solution path
- **Keep it conversational**: Ask questions and encourage their thinking
- **Guide, don't solve**: Help them discover the solution rather than giving it away

Your response should:
1. **Reference their journey**: Acknowledge they're working through this
2. **Offer a different perspective**: Provide a hint that approaches the problem from a completely different angle than previous hints
3. **Ask an engaging question**: End with something that checks their understanding or guides their next thinking step

IMPORTANT: Provide a hint that is DIFFERENT from any previous hints given. Do not repeat the same approach or concept.

Keep your response conversational and under 3-4 sentences.

PROBLEM TO ANALYZE: [PROBLEM_NAME]
USER CONTEXT: [USER_CONTEXT]
PREVIOUS HINTS: [PREVIOUS_HINTS]"""

        # Build previous hints section with sanitized data
        previous_hints_text = "No previous hints"
        if conversation_history:
            hints_list = []
            for i, interaction in enumerate(conversation_history, 1):
                hints_list.append(f"Hint {i}: {interaction['botResponse']}")
            previous_hints_text = "\n".join(hints_list)

        # Replace placeholders with sanitized values
        prompt_text = system_prompt.replace("[PROBLEM_NAME]", problem_name)
        prompt_text = prompt_text.replace("[USER_CONTEXT]", context if context else "No additional context provided")
        prompt_text = prompt_text.replace("[PREVIOUS_HINTS]", previous_hints_text)

    # --- Interact with Gemini API ---
    try:
        # Generate content using the model with the improved prompt structure
        response_gemini = model.generate_content(prompt_text)

        # Extract the text from the AI's response
        ai_full_response = response_gemini.text
        print(f"Gemini raw response:\n{ai_full_response}")

        # Parse the AI's response to separate hint and practice problem
        # Check for the "I'm not familiar" phrase first, as it's an exception case
        if "i'm not familiar with that problem" in ai_full_response.lower():
            hint_text = ai_full_response.strip()
            practice_problem_text = ""
        else:
            # Attempt to split if it's a normal hint/practice problem response
            parts = ai_full_response.split('\nTo practice this pattern, try: ', 1)

            hint_text = parts[0].strip()
            practice_problem_text = ""
            if len(parts) > 1:
                practice_problem_text = "To practice this pattern, try: " + parts[1].strip()

    except Exception as e:
        # Catch any errors during API call or response parsing
        print(f"Error calling Gemini API or parsing response: {e}")
        hint_text = "I'm sorry, I encountered an error trying to get a hint for you. Please try again in a moment."
        practice_problem_text = ""

    # Prepare the response to send back to the frontend
    response_for_frontend = {
        'hint': hint_text,
        'practiceProblem': practice_problem_text
    }

    return jsonify(response_for_frontend)

if __name__ == '__main__':
    # Production-ready configuration
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
