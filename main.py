import os 
import time
import logging

from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

import google.generativeai as genai

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

# -------------------------------------------------------------
# 1. Configure Gemini
# -------------------------------------------------------------
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

def upload_to_gemini(path, mime_type=None):
    """Uploads the given file to Gemini."""
    try:
        file_obj = genai.upload_file(path, mime_type=mime_type)
        print(f"Uploaded file '{file_obj.display_name}' as: {file_obj.uri}")
        return file_obj
    except Exception as e:
        logging.exception(f"Failed to upload file '{path}' to Gemini.")
        raise e

def wait_for_files_active(files):
    """Waits for the given files to be ACTIVE."""
    print("Waiting for file processing...")
    for f_obj in files:
        try:
            while True:
                f = genai.get_file(f_obj.name)
                if f.state.name == "PROCESSING":
                    print(".", end="", flush=True)
                    time.sleep(10)
                elif f.state.name == "ACTIVE":
                    break
                else:
                    raise Exception(f"File {f.name} failed to process with state {f.state.name}")
        except Exception as e:
            logging.exception(f"Error while waiting for file '{f_obj.name}' to become ACTIVE.")
            raise e
    print("\n...all files ready\n")

# -------------------------------------------------------------
# 2. Model & Generation Config
# -------------------------------------------------------------
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# -------------------------------------------------------------
# 3. Flask Routes
# -------------------------------------------------------------
@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Endpoint to analyze CSV file."""
    # 1. Retrieve user instructions (system_instruction) and prompt
    user_instructions = request.form.get('instructions', '').strip()
    user_prompt = request.form.get('prompt', '').strip()
    
    if not user_prompt:
        return jsonify({"error": "No prompt provided."}), 400
    
    if not user_instructions:
        user_instructions = "Conduct a brief analysis from CSV uploaded"

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file_obj = request.files['file']
    if file_obj.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not file_obj.filename.lower().endswith('.csv'):
        return jsonify({"error": "Unsupported file format. Please upload a CSV."}), 400

    # Save file temporarily
    tmp_dir = os.path.join(os.getcwd(), 'tmp_uploads')
    os.makedirs(tmp_dir, exist_ok=True)
    local_path = os.path.join(tmp_dir, secure_filename(file_obj.filename))
    file_obj.save(local_path)

    try:
        # 1) Upload to Gemini
        gemini_file = upload_to_gemini(local_path, mime_type="text/csv")
        # 2) Wait for it to become ACTIVE
        wait_for_files_active([gemini_file])

        # 3) Create a new GenerativeModel instance with the user-provided system_instruction
        model_instance = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp",
            generation_config=generation_config,
            system_instruction=user_instructions,
        )
        
        # 4) Build the initial chat history with the file
        chat_history = [
            {
                "role": "user",
                "parts": [
                    gemini_file,  # Reference to the uploaded file
                    user_prompt,  # Additional context can be added here if needed
                ],
            },
            
        ]

        # 5) Start the chat session with the initial history
        chat_session = model_instance.start_chat(history=chat_history)

        # 6) Send the user prompt to generate the analysis
        response = chat_session.send_message(user_prompt)
        analysis_text = response.text

        return jsonify({"analysis": analysis_text}), 200

    except Exception as e:
        logging.exception("Error during file analysis")
        return jsonify({"error": str(e)}), 500

    finally:
        # Clean up the local file
        if os.path.exists(local_path):
            os.remove(local_path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
