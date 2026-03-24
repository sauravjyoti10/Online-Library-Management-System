from flask import Flask, render_template, request
import google.generativeai as genai
import PyPDF2
import re
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

# ==========================
# Flask App Initialization
# ==========================
app = Flask(_name_)

# ==========================
# Gemini API Key
# ==========================
API_KEY = "AIzaSyBuXvin3Qds48XQktysHTVeAALgrkW6nQg"   # replace if you want
genai.configure(api_key=API_KEY)

# Try to load Gemini model
try:
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
except Exception as e:
    print("⚠ Gemini model not available:", e)
    model = None


# ==========================
# Local ML Backup Classifier
# ==========================
# Simple training dataset (phishing vs benign)
train_urls = [
    "http://secure-login.paypa1.com",   # phishing
    "http://free-download-software.xyz",  # malware
    "http://hacked-website.com",        # defacement
    "https://www.google.com",           # benign
    "https://www.microsoft.com",        # benign
]

labels = ["phishing", "malware", "defacement", "benign", "benign"]

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_urls)
clf = MultinomialNB()
clf.fit(X_train, labels)


def local_url_detection(url):
    """Fallback ML classifier for URLs"""
    X_test = vectorizer.transform([url])
    prediction = clf.predict(X_test)
    return prediction[0]


# ==========================
# Helper Functions
# ==========================
def predict_fake_or_real_email_content(text):
    """Classify PDF/TXT file content as Real or Scam"""
    if not model:
        return "⚠ Local mode only — Gemini unavailable."

    prompt = f"""
    Classify this text as either:
    - Real/Legitimate
    - Scam/Fake

    Text: {text}
    """
    try:
        response = model.generate_content(prompt)
        return response.text.strip() if response else "Classification failed."
    except Exception as e:
        return f"⚠ Gemini Error: {e}"


def url_detection(url):
    """Try Gemini first, then fallback to local ML"""
    if model:
        try:
            prompt = f"Classify the URL as one of: benign, phishing, malware, defacement.\nURL: {url}"
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip().lower()
        except Exception as e:
            print("⚠ Gemini failed, using local:", e)

    # fallback
    return local_url_detection(url)


# ==========================
# Routes
# ==========================
@app.route('/')
def home():
    return render_template("index.html")


@app.route('/scam/', methods=['POST'])
def detect_scam():
    """Handle file uploads (PDF/TXT)"""
    if 'file' not in request.files:
        return render_template("index.html", message="No file uploaded.")

    file = request.files['file']
    extracted_text = ""

    if file.filename.endswith('.pdf'):
        try:
            pdf_reader = PyPDF2.PdfReader(file)
            extracted_text = " ".join(
                [page.extract_text() for page in pdf_reader.pages if page.extract_text()]
            )
        except Exception:
            return render_template("index.html", message="Error reading PDF file.")
    elif file.filename.endswith('.txt'):
        try:
            extracted_text = file.read().decode("utf-8")
        except Exception:
            return render_template("index.html", message="Error reading TXT file.")
    else:
        return render_template("index.html", message="Invalid file type. Upload PDF or TXT.")

    if not extracted_text.strip():
        return render_template("index.html", message="File is empty or unreadable.")

    message = predict_fake_or_real_email_content(extracted_text)
    return render_template("index.html", message=message)


@app.route('/predict', methods=['POST'])
def predict_url():
    """Handle URL input"""
    url = request.form.get('url', '').strip()

    if not url.startswith(("http://", "https://")):
        return render_template("index.html", message="Invalid URL format.", input_url=url)

    classification = url_detection(url)
    return render_template("index.html", input_url=url, predicted_class=classification)


# ==========================
# Run the App
# ==========================
if _name_ == '_main_':
    app.run(debug=True)